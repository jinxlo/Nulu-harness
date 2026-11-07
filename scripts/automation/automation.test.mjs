import { isPromotedBaseline } from './watchdog-policy.mjs'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { assertTrustedFilesUnchanged, brandText, command, conflictsOutsideWorker, editablePath, readablePath, trustedPath } from './common.mjs'
import { buildCatalog, installerName, TARGETS, validateCatalog, validateNativeEvidence, versionOrder } from './release-catalog.mjs'
import { gatewayModelIds, validateModelPolicy } from './brand-policy.mjs'
import { adapt } from './adapter.mjs'
import { runInstaller } from './run-installer.mjs'
import './normalize-merge.test.mjs'

async function until(predicate) {
  const deadline = Date.now() + 10000
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'Owned installer fixture did not settle')
    await delay(10)
  }
}

test('installer completion does not wait for a helper that inherits its output handles', async t => {
  const root = mkdtempSync(join(tmpdir(), 'nulu-installer-handles-'))
  const pidFile = join(root, 'pid')
  const stopFile = join(root, 'stop')
  const descendant = join(root, 'descendant.cjs')
  const installer = join(root, 'installer.cjs')
  writeFileSync(descendant, `const fs = require('node:fs'); fs.writeFileSync(process.argv[2], String(process.pid)); setInterval(() => { if (fs.existsSync(process.argv[3])) process.exit(0) }, 10)`)
  writeFileSync(installer, `const fs = require('node:fs'); require('node:child_process').spawn(process.execPath, [process.argv[2], process.argv[3], process.argv[4]], { stdio: 'inherit' }); setInterval(() => { if (fs.existsSync(process.argv[3])) process.exit(0) }, 10)`)
  t.after(async () => {
    try {
      writeFileSync(stopFile, '')
      if (existsSync(pidFile)) {
        const pid = Number(readFileSync(pidFile, 'utf8'))
        await until(() => {
          try { process.kill(pid, 0); return false }
          catch (error) { if (error.code === 'ESRCH') return true; throw error }
        })
      }
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
  await runInstaller(process.execPath, [installer, descendant, pidFile, stopFile], { timeout: 10000 })
  assert.equal(existsSync(pidFile), true)
  assert.doesNotThrow(() => process.kill(Number(readFileSync(pidFile, 'utf8')), 0))
})

test('installer execution rejects a nonzero exit and a missing executable', async t => {
  const root = mkdtempSync(join(tmpdir(), 'nulu-installer-exit-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  await assert.rejects(runInstaller(process.execPath, ['-e', 'process.exit(7)']), error => error.code === 'INSTALLER_FAILED' && error.exitCode === 7)
  await assert.rejects(runInstaller(join(root, 'missing.exe'), []), error => error.code === 'ENOENT')
})

test('installer timeout rejects after the owned process exits', async () => {
  await assert.rejects(runInstaller(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeout: 100 }), error => error.code === 'ETIMEDOUT' && (error.signal !== null || error.exitCode !== null))
})

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

test('adapter requires executable tool decisions without implicit thinking', async () => {
  const result = await adapt({
    base: 'a'.repeat(40), upstream: 'b'.repeat(40), details: 'Fixture update', apiKey: 'fixture-only-key',
    fetchImpl: async (_url, request) => {
      const body = JSON.parse(request.body)
      assert.equal(body.tool_choice, 'required')
      assert.deepEqual(body.thinking, { type: 'disabled' })
      return Response.json({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', tool_calls: [{ id: 'finish', type: 'function', function: { name: 'finish', arguments: JSON.stringify({ status: 'completed', summary: 'No change required' }) } }] } }] })
    },
  })
  assert.equal(result.status, 'completed')
})

test('adapter rejects truncated decisions before executing even a complete finish call', async () => {
  await assert.rejects(adapt({
    base: 'a'.repeat(40), upstream: 'b'.repeat(40), details: 'Fixture update', apiKey: 'fixture-only-key',
    fetchImpl: async () => Response.json({
      usage: { completion_tokens: 16000 },
      choices: [{ finish_reason: 'length', message: {
        role: 'assistant', content: 'private fixture content', reasoning_content: 'private fixture reasoning',
        tool_calls: [{ id: 'finish', type: 'function', function: { name: 'finish', arguments: JSON.stringify({ status: 'completed', summary: 'Incomplete response' }) } }],
      } }],
    }),
  }), error => {
    assert.match(error.message, /output budget.*finish_reason=length.*completion_tokens=16000/)
    assert.doesNotMatch(error.message, /private fixture|fixture-only-key/)
    return true
  })
})

test('model policy requires one Nulu route with only allowed IDs', () => {
  const gateway = "const DEFAULT_MODELS = [{id: 'nulu-5-ultra'}]"
  const config = "export const PUBLIC_BASE_URL = 'https://platform.worldapptechnologies.com/api/v1'\nconst DEFAULT_API_KEY_ENV = 'WORLD_APP_TECHNOLOGIES_API_KEY'\n"
  const bundle = '- insert:\n  - id: agent-default-model\n    config:\n      provider: worldapp-gateway\n      model: nulu-5-ultra\n  - id: llm-pi-ai\n    name: pi\n  - id: llm-gateway\n    name: gateway\n'
  assert.equal(validateModelPolicy(gateway, bundle, ['nulu-5-ultra'], config), true)
  assert.throws(() => validateModelPolicy(gateway.replace('}]', "}, {id: 'foreign-model'}]"), bundle, ['nulu-5-ultra'], config))
  assert.throws(() => validateModelPolicy(gateway, bundle, ['nulu-5-ultra'], config.replace('platform.worldapptechnologies.com', 'wrong.example')))
  assert.throws(() => validateModelPolicy(gateway, bundle.replace('provider: worldapp-gateway', 'provider: worldapp'), ['nulu-5-ultra'], config))
  assert.throws(() => validateModelPolicy(gateway, bundle.replace('model: nulu-5-ultra', 'model: foreign-model'), ['nulu-5-ultra'], config))
  assert.throws(() => validateModelPolicy(gateway, bundle.replace('  - id: llm-gateway\n    name: gateway\n', ''), ['nulu-5-ultra'], config))
  const duplicate = bundle.replace('    name: pi\n', '    config:\n      providers:\n        worldapp:\n          models:\n          - id: nulu-5-ultra\n')
  assert.throws(() => validateModelPolicy(gateway, duplicate, ['nulu-5-ultra'], config), /pi-ai adapter must ship without provider profiles/)
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

test('conflicts in tests, notes and documentation stop a batch before the coding worker is asked', () => {
  const conflicts = ['apps/desktop/src/main.ts', 'apps/desktop/tests/main-startup.spec.ts', 'docs/architecture.md', '.agents/notes/implemented/architecture/note.md', 'apps/desktop/README.md', 'pnpm-lock.yaml']
  assert.deepEqual(conflictsOutsideWorker(conflicts), ['apps/desktop/tests/main-startup.spec.ts', 'docs/architecture.md', '.agents/notes/implemented/architecture/note.md', 'pnpm-lock.yaml'])
})

test('the nulu command starts the interface for a person and lists commands for a script', async () => {
  const { startArguments } = await import('../../distribution/nulu-harness/start.js')
  assert.deepEqual(startArguments([], true).args, ['web'])
  assert.match(startArguments([], true).notice, /nulu --help/)
  assert.deepEqual(startArguments([], false), { args: ['--help'] })
  assert.deepEqual(startArguments(['--profile', 'headless', 'task'], true), { args: ['--profile', 'headless', 'task'] })
  assert.equal(trustedPath('distribution/nulu-harness/bin.js'), true)
})
