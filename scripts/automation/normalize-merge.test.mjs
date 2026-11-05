/** Real Git fixtures distinguish mechanical branding merges from conflicting behavior. */
import assert from 'node:assert/strict'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { assertTrustedFilesUnchanged, brandablePath, brandText, command } from './common.mjs'
import { normalizeUpstreamMerge } from './normalize-merge.mjs'
import { rebrandTree } from './brand-tree.mjs'

function fixture(t, ancestor, ours, theirs) {
  const root = mkdtempSync(join(tmpdir(), 'nulu-brand-merge-test-'))
  const links = []
  t.after(() => {
    for (const path of links) if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) unlinkSync(path)
    rmSync(root, { recursive: true, force: true, maxRetries: 3 })
  })
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !/KEY|TOKEN|SECRET|PASSWORD|^GIT_CONFIG_/.test(name))),
    GIT_CONFIG_GLOBAL: join(root, 'global.gitconfig'), GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Merge fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Merge fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
  }
  const run = args => command('git', args, { cwd: root, env })
  const write = files => {
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      if (content === null) rmSync(join(root, path), { force: true })
      else writeFileSync(join(root, path), content)
    }
  }
  const commit = message => { run(['add', '-A']); run(['commit', '--quiet', '-m', message]); return run(['rev-parse', 'HEAD']).trim() }
  run(['init', '--quiet'])
  run(['config', 'core.autocrlf', 'false'])
  run(['symbolic-ref', 'HEAD', 'refs/heads/nulu'])
  write(ancestor)
  const start = commit('Ancestor')
  write(ours)
  const base = commit('Nulu branding')
  run(['checkout', '--quiet', '-b', 'upstream', start])
  write(theirs)
  const incoming = commit('Upstream changes')
  run(['checkout', '--quiet', 'nulu'])
  assert.throws(() => run(['merge', '--no-commit', '--no-ff', incoming]), error => error.status === 1)
  return { root, base, run, links, read: path => readFileSync(join(root, path), 'utf8') }
}

const path = 'apps/web/tests/branding.e2e.ts'
const ancestor = "import { old } from '@deepseek-ai/dsh-llm'\nexpect(old()).toBe('old')\n"
const ours = ancestor.replace('@deepseek-ai/dsh-llm', '@worldapptechnologies/nulu-llm')
const theirs = ancestor.replace('{ old }', '{ old, added }') + "expect(added()).toBe('new')\n"

test('branding merge preserves both existing and incoming test assertions', t => {
  const f = fixture(t, { [path]: ancestor }, { [path]: ours }, { [path]: theirs })
  const result = normalizeUpstreamMerge(f.base, { root: f.root })
  assert.equal(f.run(['diff', '--name-only', '--diff-filter=U']).trim(), '')
  assert.equal(f.read(path), theirs.replace('@deepseek-ai/dsh-llm', '@worldapptechnologies/nulu-llm'))
  assert.deepEqual(result.resolved, [path])
})

test('branding merge leaves behavior and binary conflicts unresolved', t => {
  const source = 'packages/example/src/value.ts'
  const binary = 'apps/example/payload.bin'
  const f = fixture(t,
    { [source]: 'export const value = 1\n', [binary]: Buffer.from([0, 1]) },
    { [source]: 'export const value = 2\n', [binary]: Buffer.from([0, 2]) },
    { [source]: 'export const value = 3\n', [binary]: Buffer.from([0, 3]) })
  const before = f.read(source)
  const bytes = readFileSync(join(f.root, binary))
  assert.deepEqual(normalizeUpstreamMerge(f.base, { root: f.root }).resolved, [])
  assert.equal(f.read(source), before)
  assert.deepEqual(readFileSync(join(f.root, binary)), bytes)
  assert.deepEqual(f.run(['diff', '--name-only', '--diff-filter=U']).trim().split('\n'), [binary, source])
})

test('normalization removes retired mirrors while retaining frozen and fixture documents', t => {
  const frozen = '.agents/notes/archived/process/frozen.zh.md'
  const sample = 'packages/example/tests/fixtures/sample.zh.md'
  const f = fixture(t,
    { [path]: ancestor, 'docs/guide.md': 'English', 'docs/guide.zh.md': 'Old translation', 'docs/guide.i18n.yaml': 'old', [frozen]: 'Frozen', '.agents/notes/archived/process/frozen.md': 'Frozen owner', [sample]: 'Fixture', 'packages/example/tests/fixtures/sample.md': 'Fixture owner', 'docs/LICENSE.md': 'License owner', 'docs/LICENSE.zh.md': 'License translation' },
    { [path]: ours, 'docs/guide.zh.md': null, 'docs/guide.i18n.yaml': null },
    { [path]: theirs, 'docs/guide.zh.md': 'Updated translation', 'docs/guide.i18n.yaml': 'updated' })
  const result = normalizeUpstreamMerge(f.base, { root: f.root })
  assert.deepEqual(result.retired.sort(), ['docs/guide.i18n.yaml', 'docs/guide.zh.md'])
  assert.equal(existsSync(join(f.root, 'docs/guide.zh.md')), false)
  assert.equal(f.read(frozen), 'Frozen')
  assert.equal(f.read(sample), 'Fixture')
  assert.equal(f.read('docs/LICENSE.zh.md'), 'License translation')
})

test('retiring translations removes only their exact English title-header link', t => {
  const note = '.agents/notes/implemented/feature/new.md'
  const header = '# Agent Note: New\n\nStatus: implemented\n\n'
  const banner = 'English | [中文](new.zh.md)\n\n'
  const body = '## Problem\n\nKeep this body and its [historical reference](other.zh.md).\n'
  const frozen = '.agents/notes/archived/feature/frozen.md'
  const frozenText = '# Frozen\n\nEnglish | [中文](frozen.zh.md)\n\nHistory\n'
  const guide = '# Guide\n\nEnglish | [中文](guide.zh.md)\n\n## Use\n\nEnglish | [中文](guide.zh.md)\n'
  const f = fixture(t, { [path]: ancestor, [frozen]: frozenText, '.agents/notes/archived/feature/frozen.zh.md': 'Frozen translation\n' }, { [path]: ours }, {
    [path]: theirs, [note]: header + banner + body,
    '.agents/notes/implemented/feature/new.zh.md': 'New translation\n',
    'docs/guide.md': guide, 'docs/guide.zh.md': 'Guide translation\n',
    'docs/missing-owner.zh.md': 'No English owner\n',
  })
  normalizeUpstreamMerge(f.base, { root: f.root })
  assert.equal(f.read(note), header + body)
  assert.equal(f.run(['show', `:${note}`]), header + body)
  assert.equal(f.read('docs/guide.md'), guide.replace('English | [中文](guide.zh.md)\n\n', ''))
  assert.equal(f.read(frozen), frozenText)
  assert.equal(f.read('.agents/notes/archived/feature/frozen.zh.md'), 'Frozen translation\n')
  assert.equal(f.read('docs/missing-owner.zh.md'), 'No English owner\n')
  assert.deepEqual(normalizeUpstreamMerge(f.base, { root: f.root }).retired, [])
  assert.equal(f.read(note), header + body)
})

test('retired-link cleanup leaves a conflicted English owner unresolved', t => {
  const note = '.agents/notes/implemented/feature/conflict.md'
  const mirror = '.agents/notes/implemented/feature/conflict.zh.md'
  const header = '# Agent Note: Conflict\n\nStatus: implemented\n\nEnglish | [中文](conflict.zh.md)\n\n'
  const f = fixture(t, { [note]: header + 'Old decision\n', [mirror]: 'Old translation\n' },
    { [note]: header + 'Nulu decision\n', [mirror]: null },
    { [note]: header + 'Upstream decision\n', [mirror]: 'New translation\n' })
  const before = f.read(note)
  normalizeUpstreamMerge(f.base, { root: f.root })
  assert.equal(f.read(note), before)
  assert.equal(f.run(['diff', '--name-only', '--diff-filter=U']).trim(), note)
  assert.equal(existsSync(join(f.root, mirror)), false)
})

test('captured Session bytes survive import and remain guarded during qualification', t => {
  const old = 'snapshots/session/example/session.v2.jsonl'
  const next = 'snapshots/session/example/session.v3.jsonl'
  const f = fixture(t, { [path]: ancestor, [old]: 'captured\n' }, { [path]: ours }, { [path]: theirs, [old]: 'rewritten\n', [next]: 'new generation\n' })
  const result = normalizeUpstreamMerge(f.base, { root: f.root })
  assert.deepEqual(result.retainedSessions, [old])
  assert.equal(f.read(old), 'captured\n')
  assert.equal(f.read(next), 'new generation\n')
  assert.doesNotThrow(() => assertTrustedFilesUnchanged(f.base, f.root))
  writeFileSync(join(f.root, old), 'build-time rewrite\n')
  assert.throws(() => assertTrustedFilesUnchanged(f.base, f.root), /session.v2.jsonl/)
})

test('branding merge refuses symlink parents without modifying the external destination', t => {
  const f = fixture(t, { [path]: ancestor }, { [path]: ours }, { [path]: theirs })
  const outside = mkdtempSync(join(tmpdir(), 'nulu-brand-merge-outside-'))
  t.after(() => rmSync(outside, { recursive: true, force: true, maxRetries: 3 }))
  mkdirSync(join(outside, 'web/tests'), { recursive: true })
  writeFileSync(join(outside, 'web/tests/branding.e2e.ts'), 'external sentinel')
  renameSync(join(f.root, 'apps'), join(f.root, 'saved-apps'))
  symlinkSync(outside, join(f.root, 'apps'), process.platform === 'win32' ? 'junction' : 'dir')
  f.links.push(join(f.root, 'apps'))
  assert.deepEqual(normalizeUpstreamMerge(f.base, { root: f.root }).resolved, [])
  assert.equal(readFileSync(join(outside, 'web/tests/branding.e2e.ts'), 'utf8'), 'external sentinel')
})

test('branding retains protocol identifiers and excludes historical-format readers', () => {
  assert.equal(brandText("kind: 'dsh'; --dsh-width; deepseekLlmApiExtensions; dsh_plugin_packages"), "kind: 'dsh'; --nulu-width; nuluLlmApiExtensions; nulu_plugin_packages")
  assert.equal(brandText('dsh.terminal.shell dsh.sidebar-right.v1 dsh.protocol.v1'), 'nulu.terminal.shell nulu.sidebar-right.v1 dsh.protocol.v1')
  assert.equal(brandText("mkdtempSync(join(tmpdir(), 'dsh-shell-')); kind: 'dsh'"), "mkdtempSync(join(tmpdir(), 'nulu-shell-')); kind: 'dsh'")
  for (const path of ['apps/cli/reference/README.md', 'docs/persistence-catalog.md', 'scripts/persistence-formats.ts', 'scripts/persistence-releases.ts', 'scripts/translation-pairing.ts', 'scripts/verify-concrete-terms.ts', 'snapshots/session/example/session.v2.jsonl']) assert.equal(brandablePath(path), false)
})

test('mechanical branding leaves the existing Nulu checkout unchanged', () => {
  assert.deepEqual(rebrandTree({ check: true }), [])
})
