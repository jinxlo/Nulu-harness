#!/usr/bin/env node
/** Run the real Nulu coding adapter for one legacy adaptation brief. */
import { readFileSync, writeFileSync } from 'node:fs'
import { adapt } from '../automation/adapter.mjs'
import { git, json } from '../automation/common.mjs'

const [briefFile, recordFile, ...args] = process.argv.slice(2)
if (!briefFile || !recordFile) throw new Error('Usage: adapt-unit.mjs <brief> <record> [--repair detail] [--context file]')
let record
try {
  const base = git(['rev-parse', 'HEAD'])
  const brief = readFileSync(briefFile, 'utf8')
  let upstream = process.env.NULU_UPSTREAM_SHA || base
  try { upstream = git(['rev-parse', json('reports/upstream-sync/adaptations/queue.json').range.split('..').at(-1)]) }
  catch { /* A standalone brief can use the current tree as its reference. */ }
  const repair = args.includes('--repair') ? args[args.indexOf('--repair') + 1] : ''
  const context = args.includes('--context') ? readFileSync(args[args.indexOf('--context') + 1], 'utf8') : ''
  const result = await adapt({ base, upstream, details: `${brief}\nRepair details: ${repair}\nAdditional context: ${context}` })
  record = { status: result.changed.length ? 'adapted' : 'no-change-required', nulu_adaptation: result.summary,
    files_changed: result.changed, validation: 'pending', turns: result.turns, confidence: 'LOW' }
} catch (error) {
  record = { status: 'failed', blocked_reason: error.message, human_review: true, validation: 'pending', confidence: 'LOW' }
  process.exitCode = 1
}
writeFileSync(recordFile, `${JSON.stringify(record, null, 2)}\n`)
