#!/usr/bin/env node
/**
 * AI adaptation runner (executor).
 *
 * Consumes the adaptation queue produced by semantic-adapt.mjs and processes
 * feature units sequentially. For each unit it:
 *
 *   load brief -> invoke adapter -> validate -> repair (limited) -> record -> commit
 *
 * Risk-based gating and dependency order are respected:
 *   - LOW/MEDIUM   adapt, validate, continue if PASS
 *   - HIGH         adapt, validate, mark for human review (not auto-integrated)
 *   - CRITICAL     prepare a proposed adaptation, validate/test, but NEVER
 *                  autonomously integrate; mandatory human approval
 *
 * The queue is already in dependency order (oldest upstream commit first), so
 * units are processed in that order and never re-sorted by risk.
 *
 * Checkpoints are committed per unit (sync(adapt): ...) and a state file enables
 * --resume so an interrupted run continues from the last successful checkpoint.
 *
 * The adapter (the AI step) is a pluggable command; by default it is a stub that
 * records "needs-manual-adaptation" and changes nothing. Set --adapter-cmd to a
 * command that performs the adaptation (it reads the brief and writes a record).
 *
 * Usage:
 *   node scripts/upstream-sync/run-adaptations.mjs            # process queue
 *   node scripts/upstream-sync/run-adaptations.mjs --plan     # dry-run plan
 *   node scripts/upstream-sync/run-adaptations.mjs --resume   # continue
 *   node scripts/upstream-sync/run-adaptations.mjs --unit N   # one unit
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ADAPT_DIR = join(ROOT, 'reports', 'upstream-sync', 'adaptations')
const STATE_FILE = join(ADAPT_DIR, 'state.json')
const MAX_REPAIR_ATTEMPTS = 2

const PLAN = process.argv.includes('--plan')
const RESUME = process.argv.includes('--resume')
const UNIT_FLAG = process.argv.indexOf('--unit')
const TARGET_UNIT = UNIT_FLAG >= 0 ? Number(process.argv[UNIT_FLAG + 1]) : undefined

// Authoritative files the adapter may read but must never change.
const POLICY_FILES = new Set([
  'upstream-policy.yml',
  'UPSTREAM_POLICY.md',
  'nulu-fork-manifest.json',
])

function run(cmd, opts = {}) {
  return execFileSync('git', cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...opts })
}

function loadQueue() {
  return JSON.parse(readFileSync(join(ADAPT_DIR, 'queue.json'), 'utf8'))
}

function loadState() {
  if (!existsSync(STATE_FILE)) return { units: [] }
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
}

function saveState(state) {
  mkdirSync(ADAPT_DIR, { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n')
}

function validate() {
  try {
    execFileSync('node', ['scripts/upstream-sync/validate.mjs', '--json'], { encoding: 'utf8' })
    return { ok: true }
  } catch (error) {
    const stdout = error.stdout ?? ''
    try {
      return { ok: false, detail: JSON.parse(stdout) }
    } catch {
      return { ok: false, detail: stdout }
    }
  }
}

function policyFilesChanged() {
  try {
    return run(['diff', '--cached', '--name-only']).trim().split('\n').filter(file => POLICY_FILES.has(file))
  } catch {
    return []
  }
}

function currentStatus(status) {
  return ['completed', 'human-review', 'blocked', 'pending']
}

function main() {
  const queue = loadQueue()
  const state = loadState()
  const statusById = new Map(state.units.map(u => [u.id, u.status]))

  // Dependency-aware: process in queue order (oldest commit first). Never sort by risk.
  const plan = queue.units

  if (PLAN) {
    console.log('[run-adaptations] execution plan (dependency order):')
    for (const unit of plan) {
      const st = statusById.get(unit.id) ?? 'pending'
      console.log(`  #${String(unit.id).padStart(3)}  ${unit.key.padEnd(22)} ${unit.max_risk.padEnd(9)} ${unit.dominant_action.padEnd(22)} ${st}`)
    }
    return
  }

  const summary = { completed: 0, human_review: 0, blocked: 0, pending: 0, processed: 0 }

  for (const unit of plan) {
    if (TARGET_UNIT !== undefined && unit.id !== TARGET_UNIT) continue
    const existing = statusById.get(unit.id)
    if (existing === 'completed') { summary.completed += 1; continue }
    if (RESUME && existing === 'pending' && TARGET_UNIT === undefined) {
      // resume: skip nothing; we continue below (state already records completed).
    }

    console.log(`\n[run-adaptations] unit #${unit.id} ${unit.key} (${unit.max_risk}, ${unit.dominant_action})`)

    const briefFile = join(ADAPT_DIR, 'briefs', `${unit.key.replace(/[^a-zA-Z0-9-]+/g, '-')}.md`)
    if (!existsSync(briefFile)) {
      console.log(`  missing brief for ${unit.key}; regenerating`)
      execFileSync('node', ['scripts/upstream-sync/prepare-adaptation.mjs', '--key', unit.key, '--commits', unit.commits.join(',')], { stdio: 'ignore' })
    }

    // Adapter step. Default stub records "needs-manual-adaptation".
    const adapterCmd = process.env.NULU_ADAPTER_CMD
    const record = {
      id: `adaptation-${String(unit.id).padStart(4, '0')}`,
      group_key: unit.key,
      upstream_commits: unit.commits,
      classification: unit.dominant_action,
      risk: unit.max_risk,
      confidence: 'LOW',
      status: 'needs-manual-adaptation',
      human_review: true,
      validation: 'skipped',
      files_changed: [],
      tests_added: [],
      invariants_affected: [],
      upstream_functionality: '',
      nulu_adaptation: '',
      corrections: [],
      generated_at: new Date().toISOString(),
    }

    if (adapterCmd !== undefined) {
      const recordFile = join(ADAPT_DIR, `record-${unit.id}.json`)
      execFileSync(adapterCmd, [briefFile, recordFile], { stdio: 'inherit' })
      if (existsSync(recordFile)) {
        Object.assign(record, JSON.parse(readFileSync(recordFile, 'utf8')))
      }
    }

    // Risk gating: CRITICAL never integrates; HIGH marks review.
    const isCritical = unit.max_risk === 'CRITICAL'
    const isHigh = unit.max_risk === 'HIGH'

    // Validation (targeted + invariants).
    let validation = validate()
    let repairAttempts = 0
    while (!validation.ok && repairAttempts < MAX_REPAIR_ATTEMPTS && adapterCmd !== undefined) {
      repairAttempts += 1
      console.log(`  validation failed; repair attempt ${repairAttempts}/${MAX_REPAIR_ATTEMPTS}`)
      const recordFile = join(ADAPT_DIR, `record-${unit.id}.json`)
      execFileSync(adapterCmd, [briefFile, recordFile, '--repair', validation.detail], { stdio: 'ignore' })
      validation = validate()
    }

    record.validation = validation.ok ? 'PASS' : 'FAIL'

    // Enforce policy write-protection.
    const policyChanged = policyFilesChanged()
    if (policyChanged.length > 0) {
      run(['reset', '--', ...policyChanged])
      console.log(`  BLOCKED: adapter attempted to modify policy files: ${policyChanged.join(', ')}`)
      record.status = 'blocked'
      record.blocked_reason = 'policy write attempt'
      record.human_review = true
      validation = { ok: false, detail: `policy files must not be modified: ${policyChanged.join(', ')}` }
    } else if (!validation.ok) {
      record.status = 'blocked'
      record.blocked_reason = 'validation_failure'
      record.human_review = true
    } else if (isCritical) {
      record.status = 'human-review'
      record.human_review = true
    } else if (isHigh) {
      record.status = 'human-review'
      record.human_review = true
    } else if (record.status === 'needs-manual-adaptation') {
      record.status = 'blocked'
      record.human_review = true
    } else {
      record.status = 'validated'
      record.human_review = false
    }

    // Record history.
    mkdirSync(ADAPT_DIR, { recursive: true })
    writeFileSync(join(ADAPT_DIR, `${record.id}.json`), JSON.stringify(record, null, 2) + '\n')

    // Commit checkpoint if the working tree changed and the unit integrated.
    const changed = run(['status', '--porcelain']).trim()
    const shouldCommit = changed.length > 0 && record.status === 'validated'
    if (shouldCommit) {
      run(['add', '-A'])
      run(['commit', '-m', `sync(adapt): ${unit.key} — ${unit.title.slice(0, 50)}`])
      console.log(`  committed checkpoint`)
    }

    const finalStatus = record.status === 'validated' ? 'completed' : record.status
    const existingIndex = state.units.findIndex(u => u.id === unit.id)
    const entry = { id: unit.id, key: unit.key, status: finalStatus, commit: record.upstream_commits, risk: unit.max_risk }
    if (existingIndex >= 0) state.units[existingIndex] = entry
    else state.units.push(entry)
    saveState(state)

    summary.processed += 1
    if (finalStatus === 'completed') summary.completed += 1
    else if (finalStatus === 'human-review') summary.human_review += 1
    else summary.blocked += 1

    console.log(`  status=${finalStatus} validation=${record.validation} repairAttempts=${repairAttempts}`)

    if (TARGET_UNIT !== undefined) break
  }

  const remaining = plan.filter(u => !statusById.has(u.id)).length
  console.log(`\n[run-adaptations] processed=${summary.processed} completed=${summary.completed} human-review=${summary.human_review} blocked=${summary.blocked}`)
  console.log(`[run-adaptations] resume with: node scripts/upstream-sync/run-adaptations.mjs --resume`)
}

main()
