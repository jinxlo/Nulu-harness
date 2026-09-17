#!/usr/bin/env node
/**
 * AI adaptation runner (executor).
 *
 * Consumes the adaptation queue and processes feature units sequentially in
 * dependency order. Per unit:
 *
 *   clean checkpoint -> load brief -> invoke adapter -> validate -> repair
 *   -> record -> commit
 *
 * Adapter contract (provider-independent): the command named by NULU_ADAPTER_CMD
 * is invoked as `<cmd> <brief> <record> [--repair <detail>] [--context <ctx>]`
 * and writes a structured record with statuses:
 *   adapted | no-change-required | blocked | needs-context |
 *   conflict-with-policy | failed
 *
 * Risk gating: LOW/MEDIUM auto-continue, HIGH marks human-review, CRITICAL is
 * never auto-integrated. Policy files are write-protected. A blocked unit is
 * recorded and independent units continue; each integrated unit is a git commit
 * (sync(adapt): ...) and a failed unit's changes are git-reset so it cannot
 * contaminate later units. state.json enables --resume.
 */

import { execFileSync, execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ADAPT_DIR = join(ROOT, 'reports', 'upstream-sync', 'adaptations')
const STATE_FILE = join(ADAPT_DIR, 'state.json')
const MAX_REPAIR_ATTEMPTS = 2
const MAX_CONTEXT_ATTEMPTS = 2

const PLAN = process.argv.includes('--plan')
const RESUME = process.argv.includes('--resume')
const UNIT_FLAG = process.argv.indexOf('--unit')
const TARGET_UNIT = UNIT_FLAG >= 0 ? Number(process.argv[UNIT_FLAG + 1]) : undefined
const ADAPTER_CMD = process.env.NULU_ADAPTER_CMD

const POLICY_FILES = new Set(['upstream-policy.yml', 'UPSTREAM_POLICY.md', 'nulu-fork-manifest.json'])

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...opts })
}

function gitClean() { return git(['status', '--porcelain']).trim() === '' }
function resetTree() { git(['reset', '--hard', 'HEAD']); git(['clean', '-fd', '-e', 'reports']) }

function validate() {
  try {
    execFileSync('node', ['scripts/upstream-sync/validate.mjs', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return { ok: true }
  } catch (error) {
    const out = error.stdout ?? ''
    try { return { ok: false, detail: JSON.parse(out) } } catch { return { ok: false, detail: out } }
  }
}

function policyStaged() {
  try { return git(['diff', '--cached', '--name-only']).trim().split('\n').filter(f => POLICY_FILES.has(f)) } catch { return [] }
}

function loadQueue() { return JSON.parse(readFileSync(join(ADAPT_DIR, 'queue.json'), 'utf8')) }
function loadState() { return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { units: [] } }
function saveState(state) { mkdirSync(ADAPT_DIR, { recursive: true }); writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n') }

function invokeAdapter(briefFile, recordFile, args = []) {
  if (ADAPTER_CMD === undefined) return null
  writeFileSync(recordFile, JSON.stringify({ status: 'failed', blocked_reason: 'adapter invocation failed' }))
  const quoted = [briefFile, recordFile, ...args].map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')
  try {
    execSync(`${ADAPTER_CMD} ${quoted}`, { stdio: 'inherit' })
  } catch {
    /* adapter may have written a record before failing */
  }
  return existsSync(recordFile) ? JSON.parse(readFileSync(recordFile, 'utf8')) : { status: 'failed' }
}

function main() {
  const queue = loadQueue()
  const state = loadState()
  const statusById = new Map(state.units.map(u => [u.id, u.status]))

  if (PLAN) {
    console.log('[run-adaptations] execution plan (dependency order):')
    for (const u of queue.units) {
      console.log(`  #${String(u.id).padStart(3)}  ${u.key.padEnd(22)} ${u.max_risk.padEnd(9)} ${u.dominant_action.padEnd(22)} ${statusById.get(u.id) ?? 'pending'}`)
    }
    return
  }

  const stats = { attempted: 0, adapted: 0, human_review: 0, blocked: 0, repair: 0, context_requests: 0, policy_blocks: 0 }

  for (const unit of queue.units) {
    if (TARGET_UNIT !== undefined && unit.id !== TARGET_UNIT) continue
    if (statusById.get(unit.id) === 'completed') { stats.adapted += 1; continue }

    console.log(`\n[run-adaptations] #${unit.id} ${unit.key} (${unit.max_risk}, ${unit.dominant_action})`)

    const briefFile = join(ADAPT_DIR, 'briefs', `${unit.key.replace(/[^a-zA-Z0-9-]+/g, '-')}.md`)
    if (!existsSync(briefFile)) {
      execFileSync('node', ['scripts/upstream-sync/prepare-adaptation.mjs', '--key', unit.key, '--commits', unit.commits.join(',')], { stdio: 'ignore' })
    }

    resetTree()
    const recordFile = join(ADAPT_DIR, `record-${unit.id}.json`)

    let record = invokeAdapter(briefFile, recordFile)
    if (record === null) {
      record = { status: 'needs-context', confidence: 'low', needs_context: { files: [], reason: 'no adapter configured' }, blocked_reason: 'no adapter configured' }
    }
    stats.attempted += 1

    // Additional-context loop.
    let contextAttempts = 0
    while (record.status === 'needs-context' && contextAttempts < MAX_CONTEXT_ATTEMPTS && ADAPTER_CMD !== undefined) {
      contextAttempts += 1
      stats.context_requests += 1
      const ctxFiles = record.needs_context?.files ?? []
      const ctx = { reason: record.needs_context?.reason ?? '', files: {} }
      for (const f of ctxFiles) {
        const abs = join(ROOT, f)
        if (existsSync(abs)) ctx.files[f] = readFileSync(abs, 'utf8')
      }
      const ctxFile = join(ADAPT_DIR, `context-${unit.id}.json`)
      writeFileSync(ctxFile, JSON.stringify(ctx, null, 2))
      console.log(`  needs-context (${contextAttempts}/${MAX_CONTEXT_ATTEMPTS}) — provided ${ctxFiles.length} file(s)`)
      record = invokeAdapter(briefFile, recordFile, ['--context', ctxFile])
    }

    // Validate + repair loop.
    let validation = validate()
    let repairAttempts = 0
    while (!validation.ok && repairAttempts < MAX_REPAIR_ATTEMPTS && ADAPTER_CMD !== undefined) {
      repairAttempts += 1
      stats.repair += 1
      console.log(`  validation failed; repair ${repairAttempts}/${MAX_REPAIR_ATTEMPTS}`)
      record = invokeAdapter(briefFile, recordFile, ['--repair', JSON.stringify(validation.detail)])
      validation = validate()
    }

    // Policy write-protection.
    const pchanged = policyStaged()
    if (pchanged.length > 0) {
      stats.policy_blocks += 1
      git(['reset', '--', ...pchanged])
      resetTree()
      record = { ...record, status: 'blocked', blocked_reason: 'policy write attempt', requires_human_review: true }
      console.log(`  POLICY-WRITE BLOCKED: ${pchanged.join(', ')}`)
      validation = { ok: false }
    }

    record.validation = validation.ok ? 'PASS' : 'FAIL'

    // Decide final status.
    const isCritical = unit.max_risk === 'CRITICAL'
    const isHigh = unit.max_risk === 'HIGH'
    let finalStatus
    if (!validation.ok) finalStatus = 'blocked'
    else if (record.status === 'conflict-with-policy' || record.status === 'failed') finalStatus = 'blocked'
    else if (isCritical) finalStatus = 'human-review'
    else if (isHigh) finalStatus = 'human-review'
    else if (record.status === 'adapted' || record.status === 'no-change-required') finalStatus = 'completed'
    else finalStatus = 'blocked'

    record.status = finalStatus
    record.risk = unit.max_risk
    record.human_review = finalStatus === 'human-review' || record.requires_human_review === true
    writeFileSync(join(ADAPT_DIR, `adaptation-${String(unit.id).padStart(4, '0')}.json`), JSON.stringify(record, null, 2) + '\n')

    if (finalStatus === 'completed') {
      if (!gitClean()) {
        git(['add', '-A'])
        git(['commit', '-m', `sync(adapt): ${unit.key} — ${unit.title.slice(0, 50)}`])
        console.log('  committed')
      } else {
        console.log('  completed (no tree changes)')
      }
      stats.adapted += 1
    } else if (finalStatus === 'human-review') {
      stats.human_review += 1
      resetTree()
      console.log(`  human-review (${unit.max_risk})`)
    } else {
      stats.blocked += 1
      resetTree()
      console.log(`  blocked (${record.blocked_reason ?? record.status})`)
    }

    const i = state.units.findIndex(u => u.id === unit.id)
    const entry = { id: unit.id, key: unit.key, status: finalStatus, risk: unit.max_risk, commits: unit.commits }
    if (i >= 0) state.units[i] = entry; else state.units.push(entry)
    saveState(state)

    if (TARGET_UNIT !== undefined) break
  }

  console.log(`\n[run-adaptations] ${JSON.stringify(stats)}`)
  console.log('[run-adaptations] resume: node scripts/upstream-sync/run-adaptations.mjs --resume')
}

main()
