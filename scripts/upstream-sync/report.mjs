#!/usr/bin/env node
/**
 * Generate the synchronization report and store it as an audit trail.
 *
 * Combines the upstream classification (classify.mjs) and the Nulu invariant
 * validation (validate.mjs) into one report. Reports are written to
 * reports/upstream-sync/ so every sync has a reviewable, auditable record.
 *
 * Usage:
 *   node scripts/upstream-sync/report.mjs [from..to]
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const range = process.argv[2]

const base = range === undefined
  ? execFileSync('git', ['merge-base', 'HEAD', 'upstream/master'], { encoding: 'utf8' }).trim()
  : range.split('..')[0]
const to = range === undefined ? 'upstream/master' : range.split('..')[1]

function run(cmd) {
  return execFileSync(cmd[0], cmd.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

const previousUpstream = base.slice(0, 12)
const newUpstream = run(['git', 'rev-parse', to]).trim().slice(0, 12)

const classification = JSON.parse(run(['node', 'scripts/upstream-sync/classify.mjs', range ?? `${base}..${to}`, '--json']))
const validation = JSON.parse(run(['node', 'scripts/upstream-sync/validate.mjs', '--json']))

const actionCounts = classification.summary
const remainingDeepseek = validation.results.find(r => r.name.startsWith('branding:'))

const report = {
  product: 'Nulu Harness',
  previous_upstream: previousUpstream,
  new_upstream: newUpstream,
  upstream_commits: actionCounts.total,
  classification: {
    auto_ported: actionCounts['AUTO-PORT'] ?? 0,
    adapted_for_nulu: (actionCounts['PORT-WITH-ADAPTATION'] ?? 0) + (actionCounts['PORT-PRESERVE-NULU'] ?? 0),
    ignored_deepseek_specific: (actionCounts['IGNORE-PROVIDER'] ?? 0) + (actionCounts['REBRAND-OR-IGNORE'] ?? 0),
    manual_review: (actionCounts['REVIEW'] ?? 0) + (actionCounts['touchingProtected'] ?? 0),
  },
  nulu_protected_files_touched: actionCounts.touchingProtected ?? 0,
  validation: {
    ok: validation.ok,
    results: validation.results,
  },
  remaining_deepseek_user_facing_references: remainingDeepseek ? remainingDeepseek.detail.split('\n').filter(Boolean).length : 0,
  generated_at: new Date().toISOString(),
}

const outDir = join(ROOT, 'reports', 'upstream-sync')
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
const outFile = join(outDir, `sync-${stamp}.json`)
writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n')

console.log(`Nulu Harness synchronization report`)
console.log(`  previous upstream: ${previousUpstream}`)
console.log(`  new upstream:      ${newUpstream}`)
console.log(`  upstream commits:  ${actionCounts.total}`)
console.log(`  auto ported:       ${report.classification.auto_ported}`)
console.log(`  adapted for Nulu:  ${report.classification.adapted_for_nulu}`)
console.log(`  ignored DeepSeek:  ${report.classification.ignored_deepseek_specific}`)
console.log(`  manual review:     ${report.classification.manual_review}`)
console.log(`  protected touched: ${report.classification.manual_review}`)
console.log(`  validation:        ${validation.ok ? 'PASS' : 'FAIL'} (${validation.results.filter(r => r.pass).length}/${validation.results.length})`)
console.log(`  DeepSeek refs:     ${report.remaining_deepseek_user_facing_references}`)
console.log(`\nReport written to ${outFile}`)
