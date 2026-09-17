#!/usr/bin/env node
/**
 * Classify upstream commits for the Nulu adaptation pipeline.
 *
 * Reads the commit range between the Nulu fork point (or an explicit ref) and
 * upstream, classifies each commit by type and touched paths, and assigns an
 * action according to upstream-policy.yml and nulu-fork-manifest.json.
 *
 * This is the "analyze before modifying" step: it produces a change queue so
 * the sync never blindly merges upstream.
 *
 * Usage:
 *   node scripts/upstream-sync/classify.mjs [from..to] [--json]
 *
 * Default range: <merge-base of upstream/master>..upstream/master
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const JSON_OUT = process.argv.includes('--json')

let range = process.argv[2]
if (range === undefined || range === '--json') {
  const base = execFileSync('git', ['merge-base', 'HEAD', 'upstream/master'], { encoding: 'utf8' }).trim()
  range = `${base}..upstream/master`
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'nulu-fork-manifest.json'), 'utf8'))
const protectedFiles = new Set((manifest.protected ?? []).map(entry => entry.file))

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

function classify(commit) {
  const message = run(['log', '-1', '--format=%s', commit]).trim()
  const body = run(['log', '-1', '--format=%b', commit]).trim()
  const files = changedFiles(commit)
  const text = `${message}\n${body}`.toLowerCase()

  const isDeepSeek = files.some(file => /deepseek|nulu/i.test(file))
    || (/deepseek|nulu-|\.nulu\b|NULU_/.test(text) && !/^merge /i.test(message))

  const type = /^fix/i.test(message) ? 'bugfix'
    : /^perf/i.test(message) ? 'performance'
    : /^feat/i.test(message) ? 'feature'
    : /^refactor/i.test(message) ? 'refactor'
    : /^release/i.test(message) ? 'release'
    : /^docs/i.test(message) ? 'documentation'
    : /^test/i.test(message) ? 'tests'
    : /^chore|^build|^ci/i.test(message) ? 'tooling'
    : 'other'

  const category = files.some(file => /^packages\/llm\/(llm-deepseek|deepseek-llm-api-extensions)/.test(file)) ? 'deepseek-provider'
    : files.some(file => /^packages\/web\/web-search-deepseek|^packages\/session\/session-log-deepseek/.test(file)) ? 'deepseek-provider'
    : files.some(file => /^packages\/client\/ui-settings-models\/src\/client\/DeepSeek/.test(file)) ? 'deepseek-ui'
    : files.some(file => /^apps\/cli|^packages\/client\/ui-|tui/i.test(file)) ? 'tui'
    : files.some(file => /^apps\/web|^website\/|^packages\/client\/ui-settings|ui-web|^packages\/client\/ui-/.test(file)) ? 'web'
    : files.some(file => /^packages\/llm\//.test(file)) ? 'llm'
    : files.some(file => /^packages\/(core|agent|session|subagent|compaction|loop|schedule|sandbox|plugin)\//.test(file)) ? 'runtime'
    : files.some(file => /^scripts\/|^\.github\/|^vitest|^tsconfig|^pnpm/.test(file)) ? 'tooling'
    : files.some(file => /\.(spec|test|e2e)\.[cm]?[jt]sx?$/.test(file) || /^tests\//.test(file)) ? 'tests'
    : files.some(file => /\.md$|^docs\//.test(file)) ? 'documentation'
    : 'runtime'

  let action
  if (isDeepSeek && category === 'deepseek-provider') action = 'IGNORE-PROVIDER'
  else if (isDeepSeek && category === 'deepseek-ui') action = 'IGNORE-UI'
  else if (isDeepSeek) action = 'REBRAND-OR-IGNORE'
  else if (category === 'bugfix' || category === 'performance') action = 'AUTO-PORT'
  else if (category === 'runtime' || category === 'llm') action = 'PORT-WITH-ADAPTATION'
  else if (category === 'tui' || category === 'web') action = 'PORT-PRESERVE-NULU'
  else if (category === 'tooling' || category === 'documentation' || category === 'tests') action = 'AUTO-PORT'
  else if (type === 'release') action = 'IGNORE-VERSION-BUMP'
  else action = 'REVIEW'

  const touchesProtected = files.filter(file => protectedFiles.has(file))

  return {
    commit,
    type,
    category,
    action,
    deepseekSpecific: isDeepSeek,
    protectedFiles: touchesProtected,
    summary: message,
  }
}

const commits = run(['log', '--reverse', '--no-merges', '--format=%H', range]).trim().split('\n').filter(Boolean)
const rows = commits.map(classify)

const summary = rows.reduce((acc, row) => {
  acc[row.action] = (acc[row.action] ?? 0) + 1
  acc.total = (acc.total ?? 0) + 1
  if (row.protectedFiles.length > 0) acc.touchingProtected = (acc.touchingProtected ?? 0) + 1
  return acc
}, {})

if (JSON_OUT) {
  console.log(JSON.stringify({ range, summary, commits: rows }, null, 2))
} else {
  console.log(`[classify] ${range}\n`)
  for (const row of rows) {
    const flags = [
      row.deepseekSpecific ? 'DeepSeek-specific' : '',
      row.protectedFiles.length > 0 ? `protected:${row.protectedFiles.join(',')}` : '',
    ].filter(Boolean).join(', ')
    console.log(`${row.commit.slice(0, 12)}  ${row.action.padEnd(22)} ${row.category.padEnd(18)} ${flags}  ${row.summary.slice(0, 70)}`)
  }
  console.log(`\n[classify] summary: ${JSON.stringify(summary)}`)
}
