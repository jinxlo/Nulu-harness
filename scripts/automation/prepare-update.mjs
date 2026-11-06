/** Import a bounded upstream batch, adapt it, and produce one fully identified candidate. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { adapt } from './adapter.mjs'
import { rebrandTree } from './brand-tree.mjs'
import { normalizeUpstreamMerge } from './normalize-merge.mjs'
import { versionOrder } from './release-catalog.mjs'
import { ROOT, REPORT, assertTrustedFilesUnchanged, command, git, json, pnpm, trustedPath } from './common.mjs'

let base = git(['rev-parse', 'HEAD'])
const report = { schemaVersion: 1, base, startedAt: new Date().toISOString(), status: 'preparing', checks: [] }
mkdirSync(join(ROOT, 'reports/upstream-sync'), { recursive: true })
const save = () => writeFileSync(join(ROOT, REPORT), `${JSON.stringify(report, null, 2)}\n`)
const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/KEY|TOKEN|SECRET|PASSWORD/.test(name)))

function restoreTools() {
  const original = new Set(git(['ls-tree', '-r', '--name-only', base]).split('\n'))
  for (const path of git(['diff', '--name-only', base]).split('\n').filter(trustedPath)) {
    if (original.has(path)) git(['restore', '--source', base, '--staged', '--worktree', '--', path])
    else git(['rm', '-f', '--ignore-unmatch', '--', path])
  }
}


function qualify() {
  const assertProtected = () => assertTrustedFilesUnchanged(base, ROOT, report.version, report.normalization?.curatedSessions)
  assertProtected()
  const steps = [
    ['policy', () => command(process.execPath, ['scripts/upstream-sync/validate.mjs', '--json'], { env: environment })],
    ['dependencies', () => pnpm(['install', '--frozen-lockfile'], { env: environment })],
    ['generated-persistence-reference', () => pnpm(['run', 'gen-persistence-catalog'], { env: environment })],
    ['build', () => pnpm(['run', 'build:official'], { env: environment })],
    ['desktop-and-catalog', () => pnpm(['exec', 'vitest', 'run', 'apps/desktop/tests', 'packages/llm/llm-pi-ai/tests/catalog.spec.ts', '--maxWorkers=2'], { env: environment })],
  ]
  for (const [name, run] of steps) {
    try { run(); assertProtected(); report.checks.push({ name, status: 'passed' }); save() }
    catch (error) {
      const detail = `${error.stdout ?? ''}\n${error.stderr ?? ''}`.slice(-14000)
      report.checks.push({ name, status: 'failed', detail }); save()
      return { name, detail }
    }
  }
}

try {
  if (git(['status', '--porcelain'])) throw new Error('Candidate preparation requires a clean working tree')
  git(['fetch', '--no-tags', 'origin', 'main'])
  const expectedMain = git(['rev-parse', 'FETCH_HEAD'])
  git(['merge', '--no-edit', expectedMain])
  base = git(['rev-parse', 'HEAD'])
  report.base = base
  report.expectedMain = expectedMain
  const baseVersion = json('package.json').version
  const publicResponse = await fetch('https://api.github.com/repos/jinxlo/Nulu-harness/releases/latest', { signal: AbortSignal.timeout(30000) })
  if (!publicResponse.ok) throw new Error(`Cannot establish current published version: HTTP ${publicResponse.status}`)
  const published = (await publicResponse.json()).tag_name?.replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+$/.test(published ?? '')) throw new Error('Published release does not identify a stable version')
  report.published = published
  git(['fetch', '--no-tags', 'https://github.com/deepseek-ai/deepseek-harness.git', 'master'])
  const latest = git(['rev-parse', 'FETCH_HEAD'])
  const checkpointFile = 'scripts/automation/upstream-state.json'
  const checkpoint = existsSync(join(ROOT, checkpointFile)) ? json(checkpointFile).integrated : git(['merge-base', base, latest])
  git(['merge-base', '--is-ancestor', checkpoint, latest])
  report.observed = latest
  report.previous = checkpoint
  const pending = git(['rev-list', '--first-parent', '--reverse', `${checkpoint}..${latest}`]).split('\n').filter(Boolean)
  report.pendingBatches = pending.length
  const baseline = process.env.NULU_BASELINE_RELEASE === 'true'
  const resumePublication = /^\d+\.\d+\.\d+$/.test(baseVersion) && versionOrder(baseVersion, published) > 0
  if (resumePublication) {
    const failure = qualify()
    if (failure) throw new Error(`Unpublished candidate failed ${failure.name}`)
    report.version = baseVersion
    report.candidate = base
    report.branch = `automation/nulu-${baseVersion}-${base.slice(0, 12)}`
    report.status = 'qualified-source'; report.resumingPublication = true; save()
    if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `changed=true\nsha=${base}\nbranch=${report.branch}\nversion=${baseVersion}\nbase=${expectedMain}\n`, { flag: 'a' })
  } else if (!baseline && pending.length === 0) {
    report.status = 'up-to-date'; save()
    if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, 'changed=false\n', { flag: 'a' })
  } else {
    let target = baseline ? checkpoint : pending[Math.min(10, pending.length) - 1]
    if (!baseline) {
      for (let count = Math.min(10, pending.length); count >= 1; count -= 1) {
        target = pending[count - 1]
        if (Buffer.byteLength(git(['diff', checkpoint, target])) <= 800000) break
      }
    }
    report.integrated = target
    const diff = baseline ? '' : git(['diff', '--stat', checkpoint, target])
    const patch = baseline ? '' : git(['diff', checkpoint, target, '--', 'apps', 'packages', 'native', 'python', 'scripts'])
    if (Buffer.byteLength(patch) > 800000) throw new Error('Upstream batch exceeds the 800 KB adaptation budget; split this batch explicitly')
    if (!baseline) {
      try { git(['merge', '--no-commit', '--no-ff', target]) }
      catch (error) {
        if (!git(['diff', '--name-only', '--diff-filter=U'])) throw error
      }
      restoreTools()
      report.normalization = normalizeUpstreamMerge(base, { upstream: target })
      rebrandTree()
      const unresolved = git(['diff', '--name-only', '--diff-filter=U'])
      report.adaptation = unresolved
        ? await adapt({ base, upstream: target, details: `Implement all compatible changes in this batch.\n${diff}\n${patch}\nUnresolved paths:\n${unresolved}` })
        : { status: 'not-required', summary: 'The branded Git merge is clean; mandatory qualification determines whether repairs are needed.' }
      for (const path of git(['diff', '--name-only', '--diff-filter=U']).split('\n').filter(Boolean)) {
        if (existsSync(join(ROOT, path)) && /^(?:<<<<<<<|=======|>>>>>>>)/m.test(readFileSync(join(ROOT, path), 'utf8'))) throw new Error(`Unresolved merge conflict: ${path}`)
      }
      restoreTools()
      rebrandTree()
    }
    const numbers = /^(\d+)\.(\d+)\.(\d+)$/.exec(baseVersion)
    if (!numbers) throw new Error('Automated releases require a stable baseline version')
    const version = `${numbers[1]}.${numbers[2]}.${Number(numbers[3]) + 1}`
    if (versionOrder(version, published) <= 0) throw new Error('Candidate cannot downgrade the published Nulu version')
    report.version = version
    for (const path of git(['ls-files', '-z']).split('\0').filter(path => path === 'package.json' || /^(?:apps\/[^/]+|packages\/[^/]+\/[^/]+)\/package\.json$/.test(path))) {
      if (!existsSync(join(ROOT, path))) continue
      const manifest = json(path)
      manifest.version = version
      writeFileSync(join(ROOT, path), `${JSON.stringify(manifest, null, 2)}\n`)
    }
    // Existing resolutions are kept; only manifests changed by this batch are resolved again, and CI must not freeze that.
    pnpm(['install', '--lockfile-only', '--no-frozen-lockfile'], { env: environment })
    let failure = qualify()
    for (let repair = 0; failure && repair < 2 && !baseline; repair += 1) {
      report.repairs = repair + 1
      await adapt({ base, upstream: target, details: `Repair this candidate without weakening checks or discarding upstream functionality. ${failure.name}:\n${failure.detail}` })
      restoreTools()
      rebrandTree()
      failure = qualify()
    }
    if (failure) throw new Error(`Candidate failed ${failure.name}`)
    // This checkpoint remains on the candidate until the native matrix and API checks qualify it.
    writeFileSync(join(ROOT, checkpointFile), `${JSON.stringify({ schemaVersion: 1, integrated: target, observed: latest }, null, 2)}\n`)
    git(['add', '-A'])
    git(['diff', '--cached', '--check'])
    git(['commit', '-m', `release: Nulu Harness ${version} (upstream ${target.slice(0, 12)})`])
    report.candidate = git(['rev-parse', 'HEAD'])
    report.branch = `automation/nulu-${version}-${report.candidate.slice(0, 12)}`
    report.status = 'qualified-source'; save()
    if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `changed=true\nsha=${report.candidate}\nbranch=${report.branch}\nversion=${version}\nbase=${expectedMain}\n`, { flag: 'a' })
  }
} catch (error) {
  report.status = 'blocked'; report.error = error.message
  report.detail = `${error.stdout ?? ''}\n${error.stderr ?? ''}`.trim().slice(-14000)
  save()
  console.error(error.message)
  if (report.detail) console.error(report.detail)
  process.exitCode = 1
}
