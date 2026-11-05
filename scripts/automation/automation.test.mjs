import { isPromotedBaseline } from './watchdog-policy.mjs'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { assertTrustedFilesUnchanged, brandText, command, editablePath, readablePath, trustedPath } from './common.mjs'
import { buildCatalog, installerName, TARGETS, validateCatalog, validateNativeEvidence, versionOrder } from './release-catalog.mjs'
import { gatewayModelIds, validateModelPolicy } from './brand-policy.mjs'
import { adapt } from './adapter.mjs'

test('release ordering rejects downgrades and compares numeric version components', () => {
  assert.ok(versionOrder('1.6.10', '1.6.9') > 0)
  assert.ok(versionOrder('1.6.1', '1.7.0') < 0)
  assert.equal(versionOrder('1.6.1', '1.6.1'), 0)
  assert.throws(() => versionOrder('next', '1.6.1'))
})

test('publication rejects native results for another commit or any unfinished required check', () => {
  const source = 'a'.repeat(40)
  const evidence = { schemaVersion: 1, target: 'win-x64', version: '1.6.1', source, branding: 'passed', updateNotification: 'passed', packagedLaunch: 'passed', profileRestart: 'passed', upgrade: 'passed', errors: [] }
  assert.equal(validateNativeEvidence(evidence, 'win-x64', '1.6.1', source), true)
  for (const errors of [undefined, 'none', ['Renderer crashed']]) {
    assert.throws(() => validateNativeEvidence({ ...evidence, errors }, 'win-x64', '1.6.1', source))
  }
  for (const field of ['branding', 'updateNotification', 'packagedLaunch', 'profileRestart', 'upgrade']) {
    assert.throws(() => validateNativeEvidence({ ...evidence, [field]: 'skipped' }, 'win-x64', '1.6.1', source))
  }
  assert.throws(() => validateNativeEvidence(evidence, 'mac-arm64', '1.6.1', source))
  assert.throws(() => validateNativeEvidence(evidence, 'win-x64', '1.6.2', source))
  assert.throws(() => validateNativeEvidence(evidence, 'win-x64', '1.6.1', 'b'.repeat(40)))
})

test('adapter blocks incomplete decisions and forbidden writes without changing policy', async () => {
  const input = { base: 'a'.repeat(40), upstream: 'b'.repeat(40), details: 'Fixture update', apiKey: 'fixture-only-key' }
  const result = (name, args) => async () => Response.json({ choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'fixture-call', type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }] })
  await assert.rejects(adapt({ ...input, fetchImpl: result('finish', { status: 'blocked', summary: 'Unverified migration' }) }), /blocked/)
  await assert.rejects(adapt({ ...input, fetchImpl: async () => Response.json({ choices: [{ message: { role: 'assistant', content: 'done' } }] }) }), /no executable decision/)
  await assert.rejects(adapt({ ...input, fetchImpl: result('write_files', { files: [{ path: 'scripts/automation/publish.mjs', content: 'unsafe' }] }) }), /file write rejected/)
  const success = await adapt({ ...input, fetchImpl: result('finish', { status: 'completed', summary: 'No change required' }) })
  assert.equal(success.status, 'completed')
  assert.deepEqual(success.changed, [])
})

test('model policy rejects foreign IDs even alongside valid Nulu IDs', () => {
  const gateway = "const DEFAULT_MODELS = [{id: 'nulu-5-ultra'}]"
  const bundle = '- insert:\n  - id: llm-pi-ai\n    config:\n      providers:\n        worldapp:\n          baseURL: https://platform.worldapptechnologies.com/api/v1\n          apiKeyEnv: WORLD_APP_TECHNOLOGIES_API_KEY\n          models:\n          - id: nulu-5-ultra\n'
  assert.equal(validateModelPolicy(gateway, bundle, ['nulu-5-ultra']), true)
  assert.throws(() => validateModelPolicy(gateway.replace('}]', "}, {id: 'foreign-model'}]"), bundle, ['nulu-5-ultra']))
  assert.throws(() => validateModelPolicy(gateway, bundle.replace('worldapp:', 'other:'), ['nulu-5-ultra']))
  assert.throws(() => validateModelPolicy(gateway, bundle.replace('https://platform.worldapptechnologies.com/api/v1', 'https://wrong.example/v1'), ['nulu-5-ultra']))
  assert.throws(() => gatewayModelIds('const DEFAULT_MODELS = unverifiedCatalog()'))
  assert.throws(() => gatewayModelIds('const DEFAULT_MODELS = [{id: unknownId}]'))
})

test('branding preserves the protected policy and bare protocol identifiers', () => {
  assert.equal(brandText("handshake dsh-persistence-schema-v1 'session-log-deepseek/delivery-accepted' @deepseek-ai/dsh-session-log-deepseek/types"), "handshake dsh-persistence-schema-v1 'session-log-deepseek/delivery-accepted' @worldapptechnologies/nulu-session-log-gateway/types")
  assert.equal(brandText('DeepSeek Harness @deepseek-ai/dsh DSH_HOME ~/.dsh thinkingFormat: deepseek'), 'Nulu Harness @worldapptechnologies/nulu NULU_HOME ~/.nulu thinkingFormat: deepseek')
  for (const path of ['.github/workflows/release.yml', 'upstream-policy.yml', 'scripts/automation/common.mjs', '.agents/notes/archived/manifest.json', 'packages/client/ui-primitives/src/NuluMark.tsx', 'apps/desktop/build/icon.png', 'apps/desktop/electron-builder.config.mjs']) assert.equal(trustedPath(path), true)
})

test('adapter rejects credentials, traversal, release tooling and test rewriting', () => {
  for (const path of ['../secret', '/etc/passwd', 'apps/../../secret', 'apps/.env', 'apps/x/../../../.git/config', 'scripts/automation/common.mjs', 'packages/x/tests/a.ts', 'packages/x/a.spec.ts', 'packages/x/AGENTS.md', 'apps\\file']) assert.throws(() => editablePath(path))
  assert.ok(readablePath('packages/x/tests/a.ts').endsWith('/packages/x/tests/a.ts'))
  for (const path of ['apps/.env', 'apps/x/node_modules/credential', '/etc/passwd', 'apps/../../secret']) assert.throws(() => readablePath(path))
})

test('adapter rejects symlink escapes without changing the destination', t => {
  const root = mkdtempSync(join(tmpdir(), 'nulu-path-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'apps'))
  symlinkSync(tmpdir(), join(root, 'apps/link'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => editablePath('apps/link/file.ts', root), /symlink/)
  assert.equal(editablePath('apps/new/file.ts', root), join(root, 'apps/new/file.ts'))
})

test('catalog requires every installer and both Mac updater ZIPs', async t => {
  const root = mkdtempSync(join(tmpdir(), 'nulu-catalog-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const target of TARGETS) writeFileSync(join(root, installerName('1.6.1', target)), `payload-${target}`)
  await assert.rejects(buildCatalog(root, '1.6.1', 'a'.repeat(40)), /Missing required/)
  for (const arch of ['arm64', 'x64']) writeFileSync(join(root, `nulu-harness-1.6.1-mac-${arch}.zip`), 'zip payload')
  const catalog = await buildCatalog(root, '1.6.1', 'a'.repeat(40))
  assert.equal(catalog.downloads.length, 4)
  for (const mutate of [
    x => x.downloads.pop(),
    x => { x.downloads[0].url = 'https://example.com/foreign.exe' },
    x => { x.downloads[0].size = 0 },
    x => { x.downloads[0].sha256 = '' },
    x => { x.downloads[0] = x.downloads[1] },
    x => { x.version = '1.6.2' },
  ]) {
    const invalid = structuredClone(catalog); mutate(invalid)
    assert.throws(() => validateCatalog(invalid))
  }
})


test('qualification rejects protected changes made by build steps, including untracked files and renames', t => {
  const root = mkdtempSync(join(tmpdir(), 'nulu-protected-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const run = args => command('git', args, { cwd: root })
  run(['init', '--quiet'])
  mkdirSync(join(root, '.github/workflows'), { recursive: true })
  writeFileSync(join(root, '.github/workflows/release.yml'), 'trusted')
  writeFileSync(join(root, 'application.txt'), 'original')
  run(['add', '.'])
  run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Fixture'])
  const base = run(['rev-parse', 'HEAD']).trim()
  writeFileSync(join(root, 'application.txt'), 'adapted')
  assert.doesNotThrow(() => assertTrustedFilesUnchanged(base, root))
  writeFileSync(join(root, '.github/workflows/release.yml'), 'rewritten')
  assert.throws(() => assertTrustedFilesUnchanged(base, root), /Protected Nulu files/)
  run(['restore', '--', '.github/workflows/release.yml'])
  writeFileSync(join(root, '.github/workflows/new.yml'), 'untracked')
  assert.throws(() => assertTrustedFilesUnchanged(base, root), /new.yml/)
  rmSync(join(root, '.github/workflows/new.yml'))
  renameSync(join(root, '.github/workflows/release.yml'), join(root, 'renamed.yml'))
  run(['add', '-A'])
  assert.throws(() => assertTrustedFilesUnchanged(base, root), /release.yml/)
})


test('pnpm exec automation can run package commands without npm_execpath', () => {
  const environment = { ...process.env }
  delete environment.npm_execpath
  const script = "import {pnpm} from './scripts/automation/common.mjs'; process.stdout.write(pnpm(['--version']))"
  const version = command(process.execPath, ['--input-type=module', '-e', script], { env: environment, timeout: 30000 }).trim()
  assert.match(version, /^\d+\.\d+\.\d+$/)
})


test('qualification permits only the allocated version in the protected brand manifest', t => {
  const root = mkdtempSync(join(tmpdir(), 'nulu-brand-version-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const run = args => command('git', args, { cwd: root })
  run(['init', '--quiet'])
  const directory = join(root, 'packages/client/ui-brand')
  mkdirSync(directory, { recursive: true })
  const file = join(directory, 'package.json')
  const manifest = { name: '@worldapptechnologies/nulu-client-ui-brand-official', version: '1.6.0' }
  const write = value => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
  write(manifest)
  run(['add', '.'])
  run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Fixture'])
  const base = run(['rev-parse', 'HEAD']).trim()
  write({ ...manifest, version: '1.6.1' })
  assert.throws(() => assertTrustedFilesUnchanged(base, root), /Protected Nulu/)
  assert.doesNotThrow(() => assertTrustedFilesUnchanged(base, root, '1.6.1'))
  assert.throws(() => assertTrustedFilesUnchanged(base, root, '1.6.2'), /Protected Nulu/)
  write({ ...manifest, version: '1.6.1', name: 'foreign-brand' })
  assert.throws(() => assertTrustedFilesUnchanged(base, root, '1.6.1'), /Protected Nulu/)
})


test('watchdog completes the baseline after later main commits but rejects divergent release history', () => {
  const source = 'a'.repeat(40)
  const release = { target_commitish: source, draft: false, prerelease: false, assets: [{ name: 'nulu-release.json' }] }
  const comparison = { status: 'ahead', base_commit: { sha: source }, merge_base_commit: { sha: source } }
  assert.equal(isPromotedBaseline(release, comparison), true)
  assert.equal(isPromotedBaseline(release, { ...comparison, status: 'identical' }), true)
  assert.equal(isPromotedBaseline(release, { ...comparison, status: 'diverged' }), false)
  assert.equal(isPromotedBaseline(release, { ...comparison, merge_base_commit: { sha: 'b'.repeat(40) } }), false)
  assert.equal(isPromotedBaseline(release, { ...comparison, base_commit: { sha: 'b'.repeat(40) } }), false)
  assert.equal(isPromotedBaseline({ ...release, draft: true }, comparison), false)
  assert.equal(isPromotedBaseline({ ...release, prerelease: true }, comparison), false)
  assert.equal(isPromotedBaseline({ ...release, assets: [] }, comparison), false)
  assert.equal(isPromotedBaseline({ ...release, target_commitish: 'main' }, comparison), false)
  assert.equal(isPromotedBaseline(release, undefined), false)
})
