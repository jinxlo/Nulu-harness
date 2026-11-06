/** Merge branded source with Git while retaining Nulu's documentation and captured-data policies. */
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { JSON_SCHEMA, load } from 'js-yaml'
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

function selectedRole(path, files) {
  const role = /^(.*\/session(?:\.\d+)?)(?:\.v(\d+))?\.jsonl(?:\.zstd)?$/.exec(path)
  if (!role) return false
  const version = Number(role[2] ?? 0)
  return [...files].every(other => {
    const candidate = /^(.*\/session(?:\.\d+)?)(?:\.v(\d+))?\.jsonl(?:\.zstd)?$/.exec(other)
    return !candidate || candidate[1] !== role[1] || other === path || Number(candidate[2] ?? 0) < version
  })
}

function currentWriterOwner(path, original, tracked, root, run, base) {
  if (!path.startsWith('snapshots/') || !selectedRole(path, original) || !selectedRole(path, tracked)) return false
  const owner = `${dirname(path)}/snapshot.yml`
  if (!original.has(owner) || !regularFile(root, owner)) return false
  const source = run(['show', `${base}:${owner}`])
  if (readFileSync(join(root, owner), 'utf8') !== source) return false
  // Classification comes from the already qualified owner; imported metadata cannot unpin history.
  const manifest = load(source, { schema: JSON_SCHEMA })
  return manifest?.version === 1 && manifest.session === undefined && manifest.sessionFormat === undefined
}

/**
 * Resolve branding-only text conflicts without asking the model to rewrite tests.
 * @param base - trusted Nulu commit identifying historical inputs and qualified scenario ownership.
 * @param options - isolated checkout and optional pinned upstream commit for exact current-writer source curation.
 * @returns resolved paths, retired mirrors, retained history and hash-pinned current-writer oracles; genuine conflicts remain unmerged.
 */
export function normalizeUpstreamMerge(base, { root = ROOT, upstream } = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/KEY|TOKEN|SECRET|PASSWORD|^GIT_CONFIG_(?:COUNT|PARAMETERS|VALUE_)/.test(name)))
  const run = (args, options = {}) => command('git', args, { cwd: root, env, ...options })
  const names = args => run(args).split('\0').filter(Boolean)
  const original = new Set(names(['ls-tree', '-r', '--name-only', '-z', base]))
  const tracked = new Set(names(['ls-files', '-z']))
  const incoming = new Set(upstream ? names(['ls-tree', '-r', '--name-only', '-z', upstream]) : [])
  const result = { resolved: [], retired: [], retainedSessions: [], curatedSessions: [] }
  let mergedTree
  const mergedOracle = path => {
    if (!mergedTree) {
      let output
      try { output = run(['merge-tree', '--write-tree', base, upstream]) }
      catch (error) {
        // Unrelated source conflicts still leave a deterministic result tree for a clean Session path.
        if (error.status !== 1 || error.signal != null) throw error
        output = error.stdout
      }
      mergedTree = output.split('\n')[0].trim()
      if (!/^[a-f0-9]{40,64}$/.test(mergedTree)) throw new Error('Git did not identify the source-curation merge tree')
    }
    return run(['show', `${mergedTree}:${path}`], { encoding: null })
  }
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
      if (incoming.has(path) && regularFile(root, path)
        && !run(['ls-files', '--unmerged', '--', path])
        && currentWriterOwner(path, original, tracked, root, run, base)) {
        const bytes = readFileSync(join(root, path))
        if (bytes.equals(mergedOracle(path))) {
          result.curatedSessions.push({ path, sha256: createHash('sha256').update(bytes).digest('hex') })
          continue
        }
      }
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
