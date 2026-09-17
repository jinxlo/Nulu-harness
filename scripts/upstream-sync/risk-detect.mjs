#!/usr/bin/env node
/**
 * High-risk architectural-change detector.
 *
 * For each upstream commit in the range, determines which foundational areas it
 * touches (from risk-areas.mjs), cross-references those areas against the Nulu
 * fork manifest, and assigns a risk level:
 *
 *   CRITICAL — touches a foundational area AND a Nulu-protected file in it
 *   HIGH     — touches a foundational area that has Nulu-protected dependencies
 *   MEDIUM   — touches a foundational area with no Nulu-protected dependencies
 *   LOW      — does not touch a foundational area
 *
 * CRITICAL changes block automatic merge and require semantic adaptation +
 * validation + human review.
 *
 * Usage:
 *   node scripts/upstream-sync/risk-detect.mjs [from..to] [--json]
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

const { RISK_AREAS, areasForPaths } = await import('./risk-areas.mjs')
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

function riskFor(commit) {
  const files = changedFiles(commit)
  const touchedAreas = areasForPaths(files)
  const touchedProtected = files.filter(file => protectedFiles.has(file))
  const message = run(['log', '-1', '--format=%s', commit]).trim()

  let risk = 'LOW'
  let reason = ''
  let blocked = false

  const areaDetails = touchedAreas.map(name => RISK_AREAS.find(area => area.area === name))

  const criticalAreas = areaDetails.filter(area => area.nuluProtected.some(file => files.includes(file)))
  const highAreas = areaDetails.filter(area => area.nuluProtected.length > 0 && !criticalAreas.includes(area))

  if (criticalAreas.length > 0) {
    risk = 'CRITICAL'
    blocked = true
    reason = `touches foundational area(s) and Nulu-protected file(s): ${criticalAreas.map(a => a.area).join(', ')}`
  } else if (highAreas.length > 0) {
    risk = 'HIGH'
    reason = `touches foundational area(s) with Nulu-protected dependencies: ${highAreas.map(a => a.area).join(', ')}`
  } else if (touchedAreas.length > 0) {
    risk = 'MEDIUM'
    reason = `touches foundational area(s): ${touchedAreas.join(', ')}`
  }

  return {
    commit,
    summary: message,
    areas: touchedAreas,
    protectedFiles: touchedProtected,
    risk,
    blocked,
    reason,
  }
}

const commits = run(['log', '--reverse', '--no-merges', '--format=%H', range]).trim().split('\n').filter(Boolean)
const rows = commits.map(riskFor)

const summary = rows.reduce((acc, row) => {
  acc[row.risk] = (acc[row.risk] ?? 0) + 1
  acc.total = (acc.total ?? 0) + 1
  if (row.blocked) acc.blocked = (acc.blocked ?? 0) + 1
  return acc
}, {})

if (JSON_OUT) {
  console.log(JSON.stringify({ range, summary, changes: rows }, null, 2))
} else {
  for (const row of rows.filter(r => r.risk !== 'LOW')) {
    console.log(`${row.commit.slice(0, 12)}  ${row.risk.padEnd(9)} ${row.reason}`)
    for (const f of row.protectedFiles) console.log(`            Nulu protected: ${f}`)
  }
  console.log(`\n[risk-detect] ${JSON.stringify(summary)}`)
}
