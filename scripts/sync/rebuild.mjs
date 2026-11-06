#!/usr/bin/env node
/**
 * Rebuild Nulu Harness on a newer upstream commit in three layers.
 *
 *   UPSTREAM          the pinned DeepSeek Harness commit, unmodified
 *   NULU BRANDING     brand-rules.mjs applied to every upstream file
 *   NULU INTEGRATION  everything in the Nulu tree that differs from branded upstream
 *
 * The rebuild is a three-way merge in branded space: base = brand(previous upstream), ours = Nulu, theirs =
 * brand(new upstream). Because both upstream sides are branded with the same rules, only the integration layer
 * can conflict. Rule-owned conflicts are resolved by rule; every other conflict is left for review and listed.
 * Nothing is pushed or published.
 *
 *   node scripts/sync/rebuild.mjs --previous <upstream sha> --upstream <upstream sha> --nulu <ref> --out <dir>
 *
 * Writes <dir>/repo (a Git repository whose `rebuild` branch holds the result) and <dir>/rebuild.json.
 */
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { BRAND_RULES_VERSION, brand, brandExempt, retiredPath } from './brand-rules.mjs'

const { values } = parseArgs({ options: { previous: { type: 'string' }, upstream: { type: 'string' }, nulu: { type: 'string', default: 'HEAD' }, out: { type: 'string' } } })
if (!values.previous || !values.upstream || !values.out) throw new Error('Usage: rebuild.mjs --previous <sha> --upstream <sha> --nulu <ref> --out <dir>')
const SOURCE = process.cwd()
const OUT = resolve(values.out)
const REPO = join(OUT, 'repo')
const env = { ...process.env, GIT_AUTHOR_NAME: 'Nulu rebuild', GIT_AUTHOR_EMAIL: 'rebuild@nuluai.invalid', GIT_COMMITTER_NAME: 'Nulu rebuild', GIT_COMMITTER_EMAIL: 'rebuild@nuluai.invalid' }
const git = (args, options = {}) => execFileSync('git', args, { cwd: REPO, env, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, ...options })
const sourceGit = args => execFileSync('git', args, { cwd: SOURCE, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 }).trim()

/** Extract one commit of the source repository into a directory. */
function extract(ref, directory) {
  mkdirSync(directory, { recursive: true })
  execFileSync('sh', ['-c', `git -C "$1" archive "$2" | tar -x -C "$3"`, 'extract', SOURCE, ref, directory], { maxBuffer: 64 * 1024 * 1024 })
}

/** Copy a tree applying the branding layer to paths and contents. */
function brandTree(from, to) {
  const walk = relative => {
    for (const name of readdirSync(join(from, relative))) {
      const path = relative ? `${relative}/${name}` : name
      const info = lstatSync(join(from, path))
      if (info.isDirectory()) { walk(path); continue }
      if (retiredPath(path)) continue
      const exempt = brandExempt(path)
      const target = join(to, exempt ? path : brand(path))
      mkdirSync(dirname(target), { recursive: true })
      if (info.isSymbolicLink()) { symlinkSync(readlinkSync(join(from, path)), target); continue }
      const bytes = readFileSync(join(from, path))
      const text = bytes.toString('utf8')
      const binary = bytes.includes(0) || !Buffer.from(text, 'utf8').equals(bytes)
      writeFileSync(target, exempt || binary ? bytes : brand(text))
      chmodSync(target, info.mode & 0o777)
    }
  }
  walk('')
}

/** Replace the work tree with a directory's content and commit it on the current branch. */
function commitTree(directory, message) {
  git(['rm', '-rq', '--cached', '--ignore-unmatch', '.'])
  for (const name of readdirSync(REPO)) if (name !== '.git') rmSync(join(REPO, name), { recursive: true, force: true })
  execFileSync('cp', ['-a', `${directory}/.`, REPO])
  git(['add', '-A', '-f'])
  git(['commit', '-q', '--allow-empty', '-m', message])
  return git(['rev-parse', 'HEAD']).trim()
}

const started = new Date().toISOString()
rmSync(OUT, { recursive: true, force: true })
mkdirSync(REPO, { recursive: true })
const nuluCommit = sourceGit(['rev-parse', values.nulu])
const stage = join(OUT, 'stage')
for (const [name, ref] of [['previous', values.previous], ['upstream', values.upstream], ['nulu', nuluCommit]]) extract(ref, join(stage, `${name}-raw`))
brandTree(join(stage, 'previous-raw'), join(stage, 'previous'))
brandTree(join(stage, 'upstream-raw'), join(stage, 'upstream'))

git(['init', '-q', '-b', 'base'])
for (const [key, value] of [['core.autocrlf', 'false'], ['merge.renameLimit', '60000'], ['diff.renameLimit', '60000'], ['merge.conflictStyle', 'diff3']]) git(['config', key, value])
const base = commitTree(join(stage, 'previous'), `branded upstream ${values.previous}`)
git(['checkout', '-q', '-b', 'rebuild'])
const nuluTree = commitTree(join(stage, 'nulu-raw'), `Nulu ${nuluCommit}`)
git(['checkout', '-q', '-b', 'upstream', base])
const incoming = commitTree(join(stage, 'upstream'), `branded upstream ${values.upstream}`)
git(['checkout', '-q', 'rebuild'])
rmSync(stage, { recursive: true, force: true })

try { git(['merge', '--no-commit', '--no-ff', 'upstream'], { stdio: 'pipe' }) } catch { /* conflicts are classified below */ }

const status = git(['status', '--porcelain=v1', '-z']).split('\0').filter(Boolean)
const conflicts = status.filter(entry => /^(?:DD|AU|UD|UA|DU|AA|UU) /.test(entry)).map(entry => ({ code: entry.slice(0, 2), path: entry.slice(3) }))
const nuluVersion = JSON.parse(git(['show', `${nuluTree}:package.json`])).version
const resolved = { retiredTranslation: [], acceptedUpstreamRemoval: [], keptNuluRemoval: [], generatedManifest: [], recordedData: [] }
const review = []

for (const { code, path } of conflicts) {
  const take = side => { git(['checkout', `--${side}`, '--', path]); git(['add', '--', path]) }
  const remove = () => git(['rm', '-q', '--', path])
  if (retiredPath(path)) { remove(); resolved.retiredTranslation.push(path); continue }
  if (code === 'UD') { remove(); resolved.acceptedUpstreamRemoval.push(path); continue }
  if (code === 'DU' && /^(?:\.agents\/notes\/|docs\/)/.test(path)) { remove(); resolved.keptNuluRemoval.push(path); continue }
  if (code === 'UU' && path.endsWith('package.json')) {
    // Manifests come from upstream; Nulu owns only the version and the repository address.
    const ours = JSON.parse(git(['show', `:2:${path}`]))
    const theirs = JSON.parse(git(['show', `:3:${path}`]))
    const others = new Set([...Object.keys(ours), ...Object.keys(theirs)].filter(key => !['version', 'repository'].includes(key)))
    const baseManifest = JSON.parse(git(['show', `:1:${path}`]))
    const nuluChangedOther = [...others].some(key => JSON.stringify(ours[key]) !== JSON.stringify(baseManifest[key]))
    if (!nuluChangedOther) {
      const merged = { ...theirs, ...(ours.version === undefined ? {} : { version: ours.version }), ...(ours.repository === undefined ? {} : { repository: ours.repository }) }
      writeFileSync(join(REPO, path), `${JSON.stringify(merged, null, 2)}\n`)
      git(['add', '--', path])
      resolved.generatedManifest.push(path)
      continue
    }
  }
  if (/^snapshots\/|(?:^|\/)(?:__snapshots__|expected)\/|\.expected\.|^\.agents\/notes\/|^docs\/(?:persistence-changes|subsystems|i18n)\//.test(path)) {
    // Recorded output and upstream design notes follow upstream; qualification regenerates or checks them.
    if (code === 'DU' || code === 'UA' || code === 'AU' || code === 'UU' || code === 'AA') { take('theirs'); resolved.recordedData.push(path); continue }
  }
  review.push({ code, path })
}

const area = path => path.split('/').slice(0, path.startsWith('packages/') || path.startsWith('apps/') ? 3 : 2).join('/')
const byArea = review.reduce((map, { path }) => map.set(area(path), (map.get(area(path)) ?? 0) + 1), new Map())
const report = {
  schemaVersion: 1,
  startedAt: started,
  finishedAt: new Date().toISOString(),
  upstream: { previous: values.previous, target: values.upstream },
  nulu: { commit: nuluCommit, version: nuluVersion },
  brandRulesVersion: BRAND_RULES_VERSION,
  mergeConflicts: conflicts.length,
  resolvedByRule: Object.fromEntries(Object.entries(resolved).map(([key, list]) => [key, list.length])),
  needsReview: review.length,
  needsReviewProductCode: review.filter(({ path }) => /^(?:apps|packages|native|python|vendor|scripts)\//.test(path) && !/\.md$/.test(path) && !/(?:^|\/)(?:tests?|fixtures)\/|\.(?:spec|test|e2e)\./.test(path)).length,
  reviewByArea: Object.fromEntries([...byArea].sort((a, b) => b[1] - a[1])),
  review,
}
writeFileSync(join(OUT, 'rebuild.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, review: undefined, reviewByArea: Object.fromEntries(Object.entries(report.reviewByArea).slice(0, 25)) }, null, 2))
