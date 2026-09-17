#!/usr/bin/env node
/**
 * Dependency-aware grouping of upstream commits into logical adaptation units.
 *
 * Groups commits by their conventional-commit scope (falling back to the
 * dominant changed area), so a feature spread across several commits becomes one
 * adaptation unit instead of many unrelated patches.
 *
 * Usage:
 *   node scripts/upstream-sync/group.mjs [from..to] [--json]
 */

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const JSON_OUT = process.argv.includes('--json')

let range = process.argv[2]
if (range === undefined || range === '--json') {
  const base = execFileSync('git', ['merge-base', 'HEAD', 'upstream/master'], { encoding: 'utf8' }).trim()
  range = `${base}..upstream/master`
}

function run(cmd) {
  return execFileSync('git', cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

function changedFiles(commit) {
  try {
    return run(['diff-tree', '--no-commit-id', '--name-only', '-r', commit]).trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

const SCOPE_RE = /^(?:feat|fix|perf|refactor|chore|docs|test|build|ci|release)\(([^)]+)\)/

// Per-commit feature key: conventional-commit scope, else the dominant path.
function featureKey(commit) {
  const message = run(['log', '-1', '--format=%s', commit]).trim()
  const match = message.match(SCOPE_RE)
  if (match) return match[1]
  const files = changedFiles(commit)
  if (files.length === 0) return 'misc'
  const top = files[0].split('/')
  return top[0] === 'packages' || top[0] === 'apps' || top[0] === 'website' || top[0] === 'scripts'
    ? top.slice(0, 2).join('/')
    : top[0]
}

const commits = run(['log', '--reverse', '--no-merges', '--format=%H', range]).trim().split('\n').filter(Boolean)

const groups = []
for (const commit of commits) {
  const key = featureKey(commit)
  const last = groups[groups.length - 1]
  if (last && last.key === key) {
    last.commits.push(commit)
  } else {
    groups.push({ key, commits: [commit] })
  }
}

const output = groups.map((group, index) => {
  const message = run(['log', '-1', '--format=%s', group.commits[0]]).trim()
  const clean = message.replace(/^[a-z]+(?:\([^)]+\))?!?: ?/, '')
  return {
    id: index + 1,
    key: group.key,
    title: clean || group.key,
    commits: group.commits,
    count: group.commits.length,
  }
})

if (JSON_OUT) {
  console.log(JSON.stringify({ range, total_commits: commits.length, groups: output }, null, 2))
} else {
  for (const group of output) {
    console.log(`#${String(group.id).padStart(3)}  ${group.key.padEnd(24)} ${group.count} commit(s)  ${group.title.slice(0, 60)}`)
  }
  console.log(`\n[group] ${commits.length} commits -> ${output.length} feature groups`)
}
