#!/usr/bin/env node
/**
 * Semantic-adaptation orchestrator (Level 3).
 *
 * Runs the full analysis pipeline — classify → risk → group — then produces,
 * for every group that needs adaptation, the context briefs an AI coding agent
 * consumes to port upstream functionality while preserving Nulu invariants.
 *
 * It does NOT perform the adaptation itself; it prepares the work and records
 * a queue so adaptation happens incrementally, one group at a time, with
 * validation after each.
 *
 * Usage:
 *   node scripts/upstream-sync/semantic-adapt.mjs [from..to] [--json]
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const JSON_OUT = process.argv.includes('--json')

let range = process.argv[2]
if (range === undefined || range === '--json') {
  const base = execFileSync('git', ['merge-base', 'HEAD', 'upstream/master'], { encoding: 'utf8' }).trim()
  range = `${base}..upstream/master`
}

function node(args) {
  return JSON.parse(execFileSync('node', args, { encoding: 'utf8' }))
}

const classification = node(['scripts/upstream-sync/classify.mjs', range, '--json'])
const risk = node(['scripts/upstream-sync/risk-detect.mjs', range, '--json'])
const grouping = node(['scripts/upstream-sync/group.mjs', range, '--json'])

const actionByCommit = new Map(classification.commits.map(c => [c.commit, c]))
const riskByCommit = new Map(risk.changes.map(c => [c.commit, c]))

const NEEDS_ADAPTATION = new Set(['PORT-WITH-ADAPTATION', 'PORT-PRESERVE-NULU', 'REVIEW', 'REBRAND-OR-IGNORE'])

const units = grouping.groups.map((group) => {
  const actions = group.commits.map(hash => actionByCommit.get(hash)?.action ?? 'AUTO-PORT')
  const risks = group.commits.map(hash => riskByCommit.get(hash)?.risk ?? 'LOW')
  const maxRisk = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].reduce((a, b) => (risks.includes(b) ? b : a), 'LOW')
  const touchesProtected = group.commits.some(hash => (riskByCommit.get(hash)?.protectedFiles?.length ?? 0) > 0)
  const dominantAction = actions.includes('REVIEW') ? 'REVIEW'
    : actions.includes('PORT-WITH-ADAPTATION') ? 'PORT-WITH-ADAPTATION'
    : actions.includes('PORT-PRESERVE-NULU') ? 'PORT-PRESERVE-NULU'
    : actions.includes('IGNORE-PROVIDER') ? 'IGNORE-PROVIDER'
    : actions.includes('REBRAND-OR-IGNORE') ? 'REBRAND-OR-IGNORE'
    : 'AUTO-PORT'

  const needsAdaptation = NEEDS_ADAPTATION.has(dominantAction) || maxRisk === 'HIGH' || maxRisk === 'CRITICAL'

  return {
    id: group.id,
    key: group.key,
    title: group.title,
    commits: group.commits,
    count: group.count,
    dominant_action: dominantAction,
    max_risk: maxRisk,
    touches_protected: touchesProtected,
    needs_adaptation: needsAdaptation,
  }
})

const outDir = join(ROOT, 'reports', 'upstream-sync', 'adaptations')
mkdirSync(outDir, { recursive: true })

// Generate briefs for every unit needing adaptation.
for (const unit of units.filter(u => u.needs_adaptation)) {
  execFileSync('node', [
    'scripts/upstream-sync/prepare-adaptation.mjs',
    '--key', unit.key,
    '--commits', unit.commits.join(','),
  ], { stdio: 'ignore' })
}

const queue = {
  range,
  generated_at: new Date().toISOString(),
  units,
  summary: {
    total_groups: units.length,
    needs_adaptation: units.filter(u => u.needs_adaptation).length,
    auto_port: units.filter(u => u.dominant_action === 'AUTO-PORT' && !u.needs_adaptation).length,
    ignored_provider: units.filter(u => u.dominant_action === 'IGNORE-PROVIDER').length,
    critical: units.filter(u => u.max_risk === 'CRITICAL').length,
    high: units.filter(u => u.max_risk === 'HIGH').length,
    protected_touched: units.filter(u => u.touches_protected).length,
  },
}

writeFileSync(join(outDir, 'queue.json'), JSON.stringify(queue, null, 2) + '\n')

if (JSON_OUT) {
  console.log(JSON.stringify(queue, null, 2))
} else {
  for (const unit of units.filter(u => u.needs_adaptation)) {
    const flags = [unit.max_risk !== 'LOW' ? unit.max_risk : '', unit.touches_protected ? 'protected' : ''].filter(Boolean).join(',')
    console.log(`#${String(unit.id).padStart(3)}  ${unit.key.padEnd(22)} ${unit.dominant_action.padEnd(22)} ${(flags || '').padEnd(16)} ${unit.count} commit(s)  ${unit.title.slice(0, 50)}`)
  }
  console.log(`\n[semantic-adapt] ${JSON.stringify(queue.summary)}`)
  console.log(`[semantic-adapt] briefs written to ${join(outDir, 'briefs')}; queue at ${join(outDir, 'queue.json')}`)
}
