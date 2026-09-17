#!/usr/bin/env node
/**
 * Generate the semantic-adaptation brief for one feature group.
 *
 * The brief is the complete context bundle an AI coding agent needs to adapt
 * upstream functionality into Nulu Harness: the upstream diff, the current Nulu
 * versions of the affected files, the fork policy and manifest, relevant tests,
 * and any prior adaptation history for the same area.
 *
 * Usage:
 *   node scripts/upstream-sync/prepare-adaptation.mjs <group-key> [--json]
 *
 * The group key comes from group.mjs (e.g. "boot", "web", "llm-pi-ai").
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const JSON_OUT = process.argv.includes('--json')

function argAfter(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const GROUP_KEY = argAfter('--key') ?? process.argv[2]
const COMMITS_ARG = argAfter('--commits')

if (GROUP_KEY === undefined) {
  console.error('usage: node scripts/upstream-sync/prepare-adaptation.mjs <group-key> [--commits h1,h2,...] [--json]')
  process.exit(2)
}

const policy = readFileSync(join(ROOT, 'upstream-policy.yml'), 'utf8')
const policyMd = readFileSync(join(ROOT, 'UPSTREAM_POLICY.md'), 'utf8')
const manifest = JSON.parse(readFileSync(join(ROOT, 'nulu-fork-manifest.json'), 'utf8'))

function run(cmd, maxBuffer = 10 * 1024 * 1024) {
  return execFileSync('git', cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer })
}

// Explicit commit list wins; otherwise derive the group's commits from the key.
let groupCommits
if (COMMITS_ARG !== undefined) {
  groupCommits = COMMITS_ARG.split(',').filter(Boolean)
} else {
  const base = run(['merge-base', 'HEAD', 'upstream/master']).trim()
  const commits = run(['log', '--reverse', '--no-merges', '--format=%H', `${base}..upstream/master`]).trim().split('\n').filter(Boolean)
  groupCommits = commits.filter((commit) => {
    const message = run(['log', '-1', '--format=%s', commit]).trim()
    const match = message.match(/^(?:feat|fix|perf|refactor|chore|docs|test|build|ci|release)\(([^)]+)\)/)
    const key = match ? match[1] : (() => {
      const files = run(['diff-tree', '--no-commit-id', '--name-only', '-r', commit]).trim().split('\n').filter(Boolean)
      if (files.length === 0) return 'misc'
      const top = files[0].split('/')
      return ['packages', 'apps', 'website', 'scripts'].includes(top[0]) ? top.slice(0, 2).join('/') : top[0]
    })()
    return key === GROUP_KEY
  })
}

if (groupCommits.length === 0) {
  console.error(`[prepare-adaptation] no commits found for group "${GROUP_KEY}"`)
  process.exit(2)
}

// Affected files (union across the group).
const files = new Set()
for (const commit of groupCommits) {
  for (const file of run(['diff-tree', '--no-commit-id', '--name-only', '-r', commit]).trim().split('\n').filter(Boolean)) {
    files.add(file)
  }
}
const affected = [...files].filter(file => !/\.(snap|expected\.md)$/.test(file))

// Current Nulu versions of the affected files (those that exist).
const nuluFiles = {}
for (const file of affected) {
  const abs = join(ROOT, file)
  if (existsSync(abs)) {
    nuluFiles[file] = readFileSync(abs, 'utf8')
  }
}

// Relevant tests.
const tests = affected
  .map(file => file.replace(/\.(ts|tsx|mts|cts)$/, ''))
  .flatMap(stem => [`${stem}.spec.ts`, `${stem}.test.ts`, `${stem}.e2e.ts`])
  .filter(file => existsSync(join(ROOT, file)))

// Prior adaptation history for the same area.
const historyDir = join(ROOT, 'reports', 'upstream-sync', 'adaptations')
const history = []
if (existsSync(historyDir)) {
  for (const entry of readdirSync(historyDir)) {
    if (!entry.endsWith('.json')) continue
    const record = JSON.parse(readFileSync(join(historyDir, entry), 'utf8'))
    if ((record.group_key ?? '') === GROUP_KEY || (record.areas ?? []).some(area => affected.some(f => f.includes(area)))) {
      history.push({ id: record.id, summary: record.summary, files_changed: record.files_changed, validation: record.validation })
    }
  }
}

const brief = {
  group_key: GROUP_KEY,
  commits: groupCommits.map(commit => ({
    hash: commit,
    message: run(['log', '-1', '--format=%s', commit]).trim(),
  })),
  upstream_diff: run(['diff', `${groupCommits[0]}^1`, groupCommits[groupCommits.length - 1]], 200 * 1024 * 1024).slice(0, 200_000),
  affected_files: affected,
  nulu_current_files: nuluFiles,
  relevant_tests: tests,
  prior_adaptations: history,
}

if (JSON_OUT) {
  console.log(JSON.stringify(brief, null, 2))
} else {
  const md = []
  md.push(`# Adaptation brief — ${GROUP_KEY}\n`)
  md.push(`**Upstream commits:** ${groupCommits.map(c => `\`${c.slice(0, 12)}\``).join(', ')}\n`)
  for (const commit of groupCommits) {
    md.push(`- \`${commit.slice(0, 12)}\` ${run(['log', '-1', '--format=%s', commit]).trim()}`)
  }
  md.push(`\n## Affected files\n`)
  for (const file of affected) md.push(`- ${file}`)
  md.push(`\n## Relevant Nulu tests\n`)
  if (tests.length === 0) md.push(`(none)`)
  for (const file of tests) md.push(`- ${file}`)
  md.push(`\n## Prior adaptations\n`)
  if (history.length === 0) md.push(`(none)`)
  for (const h of history) md.push(`- ${h.id}: ${h.summary ?? ''} (${h.validation ?? 'unvalidated'})`)
  md.push(`\n## Nulu policy (authoritative — must not be violated)\n`)
  md.push('```yaml')
  md.push(policy)
  md.push('```')
  md.push(`\n## Fork manifest (protected files)\n`)
  md.push('```json')
  md.push(JSON.stringify(manifest, null, 2))
  md.push('```')

  const outDir = join(historyDir, 'briefs')
  mkdirSync(outDir, { recursive: true })
  const safeKey = GROUP_KEY.replace(/[^a-zA-Z0-9-]+/g, '-')
  const outFile = join(outDir, `${safeKey}.md`)
  writeFileSync(outFile, md.join('\n'))
  console.log(md.join('\n'))
  console.log(`\n[prepare-adaptation] brief written to ${outFile}`)
}
