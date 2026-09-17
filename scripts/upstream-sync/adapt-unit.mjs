#!/usr/bin/env node
/**
 * Adapter hook for run-adaptations.mjs.
 *
 * This is the pluggable "AI step". The executor invokes it as:
 *
 *   node scripts/upstream-sync/adapt-unit.mjs <brief-file> <record-file> [--repair <detail>]
 *
 * The adapter reads the brief (the full context bundle), performs the semantic
 * adaptation against the working tree, and writes a record JSON to the record
 * file describing what it did.
 *
 * THIS STUB does not perform any adaptation. It records "needs-manual-adaptation"
 * so the executor marks the unit for human review. Replace it (or point
 * NULU_ADAPTER_CMD at another command) with a real agent that implements the
 * upstream functionality while preserving the Nulu invariants.
 */

import { readFileSync, writeFileSync } from 'node:fs'

const briefFile = process.argv[2]
const recordFile = process.argv[3]
const repairing = process.argv.includes('--repair')

const brief = readFileSync(briefFile, 'utf8')
const unitId = brief.match(/group_key: (\S+)/)?.[1] ?? 'unit'

const record = {
  id: `adaptation-${unitId.replace(/[^a-zA-Z0-9-]+/g, '-')}`,
  group_key: unitId,
  upstream_commits: [],
  classification: '',
  risk: '',
  confidence: 'LOW',
  upstream_functionality: '',
  nulu_adaptation: '',
  files_changed: [],
  tests_added: [],
  invariants_affected: [],
  validation: 'pending',
  status: repairing ? 'repair-attempted' : 'needs-manual-adaptation',
  blocked_reason: 'no adapter configured — manual semantic adaptation required',
  human_review: true,
  corrections: [],
  generated_at: new Date().toISOString(),
}

writeFileSync(recordFile, JSON.stringify(record, null, 2) + '\n')
console.log(`[adapt-unit] stub adapter: ${unitId} marked needs-manual-adaptation`)
