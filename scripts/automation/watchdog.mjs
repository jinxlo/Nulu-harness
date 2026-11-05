/** Independent server heartbeat: recover missing hourly runs without publishing any release itself. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { command } from './common.mjs'
import { isPromotedBaseline } from './watchdog-policy.mjs'

const response = JSON.parse(command('gh', ['api', 'repos/jinxlo/Nulu-harness/actions/workflows/nulu-update.yml/runs?per_page=1']))
const workflow = JSON.parse(command('gh', ['api', 'repos/jinxlo/Nulu-harness/actions/workflows/nulu-update.yml']))
const latest = response.workflow_runs?.[0]
const age = latest ? Date.now() - Date.parse(latest.created_at) : Infinity
const record = { checkedAt: new Date().toISOString(), run: latest?.html_url, conclusion: latest?.conclusion, ageMinutes: age / 60000 }
const statusFile = '/home/luis/nulu-harness-automation-status.json'
const previous = existsSync(statusFile) ? JSON.parse(readFileSync(statusFile, 'utf8')) : {}
record.baselineCompleted = previous.baselineCompleted === true
if (!record.baselineCompleted) {
  const release = JSON.parse(command('gh', ['api', 'repos/jinxlo/Nulu-harness/releases/latest']))
  const source = release.target_commitish
  const comparison = /^[a-f0-9]{40}$/.test(source ?? '') && release.assets.some(asset => asset.name === 'nulu-release.json')
    ? JSON.parse(command('gh', ['api', `repos/jinxlo/Nulu-harness/compare/${source}...main`])) : undefined
  if (isPromotedBaseline(release, comparison)) {
    command('gh', ['variable', 'set', 'NULU_AUTOMATION_SOURCE_REF', '--repo', 'jinxlo/Nulu-harness', '--body', 'main'])
    command('gh', ['variable', 'set', 'NULU_NEEDS_BASELINE', '--repo', 'jinxlo/Nulu-harness', '--body', 'false'])
    record.baselineCompleted = true
  }
}
if (workflow.state === 'disabled_inactivity') command('gh', ['workflow', 'enable', 'nulu-update.yml', '--repo', 'jinxlo/Nulu-harness'])
if (workflow.state !== 'disabled_manually' && (!latest || (age > 2 * 60 * 60 * 1000 && latest.status === 'completed'))) {
  command('gh', ['workflow', 'run', 'nulu-update.yml', '--repo', 'jinxlo/Nulu-harness', '--ref', 'main'])
  record.dispatched = true
}
writeFileSync(statusFile, `${JSON.stringify(record, null, 2)}\n`)
if (latest?.status !== 'completed' && age > 4 * 60 * 60 * 1000) throw new Error(`Nulu update run has not completed: ${latest.html_url}`)
console.log(JSON.stringify(record))
