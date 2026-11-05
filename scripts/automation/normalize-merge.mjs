/** Merge branded source with Git while retaining Nulu's documentation and captured-data policies. */
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { ROOT, brandablePath, brandText, command, readablePath, sessionGenerationPath } from './common.mjs'

function regularFile(root, path) {
  let current = root
  for (const part of path.split('/')) {
    if (!part || part === '.' || part === '..' || part.includes('\\')) throw new Error('Invalid tracked merge path')
    current = join(current, part)
    const entry = lstatSync(current, { throwIfNoEntry: false })
    if (!entry || entry.isSymbolicLink()) return false
  }
  return lstatSync(current).isFile()
}

function retiredMirror(path, tracked) {
  if (!/^(?:docs\/|\.agents\/notes\/(?:implemented|proposed|rejected)\/|apps\/|packages\/)/.test(path)
    || /^(?:docs\/persistence-changes\/)/.test(path)
    || /(?:^|\/)(?:LICENSE|NOTICE|THIRD_PARTY|CHANGELOG)/i.test(path)
    || /(?:^|\/)(?:tests?|fixtures|snapshots)(?:\/|$)/.test(path)) return false
  const english = path.endsWith('.zh.md') ? path.slice(0, -6) + '.md'
    : path.endsWith('.i18n.yaml') ? path.slice(0, -10) + '.md' : undefined
  return english !== undefined && tracked.has(english)
}

/**
 * Resolve branding-only text conflicts without asking the model to rewrite tests.
 * @param base - trusted Nulu commit whose existing Session generations remain immutable.
 * @param options - isolated checkout directory; defaults to the automation checkout.
 * @returns resolved source paths, removed retired mirrors, and restored captured inputs; genuine conflicts remain staged as unmerged.
 */
export function normalizeUpstreamMerge(base, { root = ROOT } = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/KEY|TOKEN|SECRET|PASSWORD|^GIT_CONFIG_(?:COUNT|PARAMETERS|VALUE_)/.test(name)))
  const run = (args, options = {}) => command('git', args, { cwd: root, env, ...options })
  const names = args => run(args).split('\0').filter(Boolean)
  const original = new Set(names(['ls-tree', '-r', '--name-only', '-z', base]))
  const tracked = new Set(names(['ls-files', '-z']))
  const result = { resolved: [], retired: [], retainedSessions: [] }
  for (const path of tracked) {
    if (retiredMirror(path, tracked) && regularFile(root, path)) {
      run(['rm', '-f', '--ignore-unmatch', '--', path])
      result.retired.push(path)
      if (path.endsWith('.zh.md')) {
        const english = path.slice(0, -6) + '.md'
        if (!regularFile(root, english) || run(['ls-files', '--unmerged', '--', english])) continue
        const lines = readFileSync(join(root, english), 'utf8').split('\n')
        const banner = `English | [中文](${basename(path)})`
        // Only the known title/status header admits automatic removal; body links remain checked.
        const index = lines[0]?.startsWith('# ') && lines[1] === ''
          ? lines[2] === banner ? 2
            : lines[2]?.startsWith('Status: ') && lines[3] === '' && lines[4] === banner ? 4 : -1
          : -1
        if (index >= 0) {
          lines.splice(index, lines[index + 1] === '' ? 2 : 1)
          writeFileSync(join(root, english), lines.join('\n'))
          run(['add', '--', english])
        }
      }
    }
  }
  for (const path of names(['diff', '--no-renames', '--name-only', '-z', base])) {
    if (original.has(path) && sessionGenerationPath(path)) {
      run(['restore', '--source', base, '--staged', '--worktree', '--', path])
      result.retainedSessions.push(path)
    }
  }
  const conflicts = new Map()
  for (const record of names(['ls-files', '--unmerged', '-z'])) {
    const tab = record.indexOf('\t')
    const path = record.slice(tab + 1)
    const [mode, object, stage] = record.slice(0, tab).split(' ')
    if (!conflicts.has(path)) conflicts.set(path, {})
    conflicts.get(path)[stage] = { mode, object }
  }
  const scratch = mkdtempSync(join(tmpdir(), 'nulu-branded-merge-'))
  try {
    for (const [path, stages] of conflicts) {
      if (!brandablePath(path) || !regularFile(root, path)
        || ![1, 2, 3].every(stage => /^100(?:644|755)$/.test(stages[stage]?.mode ?? ''))) continue
      const destination = readablePath(path, root)
      const files = []
      for (const stage of [2, 1, 3]) {
        const bytes = run(['cat-file', 'blob', stages[stage].object], { encoding: null })
        if (bytes.includes(0) || !Buffer.from(bytes.toString('utf8')).equals(bytes)) break
        const file = join(scratch, String(stage))
        writeFileSync(file, brandText(bytes.toString('utf8'), { providerFixture: /(?:^|\/)(?:tests?|fixtures)(?:\/|$)|\.(?:spec|test|e2e)\./.test(path) }))
        files.push(file)
      }
      if (files.length !== 3) continue
      let merged
      try { merged = run(['merge-file', '-p', '--', ...files], { timeout: 10000 }) }
      catch (error) {
        // Git returns the conflict count (capped at 127); larger statuses and timeouts are failures.
        if (error.code !== 'ETIMEDOUT' && error.signal == null
          && Number.isInteger(error.status) && error.status >= 1 && error.status <= 127) continue
        throw error
      }
      writeFileSync(destination, merged)
      run(['add', '--', path])
      result.resolved.push(path)
    }
  } finally { rmSync(scratch, { recursive: true, force: true }) }
  return result
}
