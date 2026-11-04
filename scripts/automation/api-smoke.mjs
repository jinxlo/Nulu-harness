/** Qualify real inference, streamed tool execution, and persisted-session resume through the built CLI. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ROOT } from './common.mjs'

const key = process.env.WORLD_APP_TECHNOLOGIES_API_KEY
assert.ok(key?.trim(), 'A real Nulu test credential is required')
const base = 'https://platform.worldapptechnologies.com/api/v1'
const headers = { authorization: `Bearer ${key}`, 'content-type': 'application/json' }
const modelsResponse = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(30000) })
assert.equal(modelsResponse.status, 200, 'Model discovery must succeed')
const models = (await modelsResponse.json()).data.map(model => model.id)
assert.ok(models.includes('nulu-5-ultra') && models.includes('nulu-5-pro'))
assert.ok(models.every(model => model.startsWith('nulu-')), 'Public discovery must contain only Nulu models')
const completion = await fetch(`${base}/chat/completions`, {
  method: 'POST', headers, body: JSON.stringify({ model: 'nulu-5-pro', messages: [{ role: 'user', content: 'Reply with exactly NULU_OK.' }], max_tokens: 512, thinking: { type: 'disabled' } }), signal: AbortSignal.timeout(120000),
})
assert.equal(completion.status, 200, 'Real non-streaming inference must succeed')
assert.match((await completion.json()).choices[0].message.content, /NULU_OK/)
const workspace = mkdtempSync(join(tmpdir(), 'nulu-api-smoke-'))
try {
  const env = { ...process.env, NULU_HOME: join(workspace, 'home'), WORLD_APP_TECHNOLOGIES_BASE_URL: base, NULU_TELEMETRY_DISABLED: '1' }
  delete env.GH_TOKEN
  delete env.GITHUB_TOKEN
  const run = args => execFileSync(process.execPath, [join(ROOT, 'apps/cli/lib/bin.js'), '--profile', 'headless', ...args], { cwd: workspace, env, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024 })
  const output = run(['--json', 'Use a file-writing tool to create verification.txt in the current directory containing exactly NULU_TOOL_OK followed by a newline. Remember the code violet-river-6284 for our next turn. Report briefly.'])
  assert.equal(readFileSync(join(workspace, 'verification.txt'), 'utf8'), 'NULU_TOOL_OK\n')
  const events = output.trim().split('\n').map(line => JSON.parse(line))
  const session = events.find(event => typeof event.sessionId === 'string')?.sessionId
  assert.ok(session, 'Streamed output must identify the persisted session')
  const resumed = run(['--session-id', session, 'What exact code did I ask you to remember? Reply with only that code.'])
  assert.match(resumed, /violet-river-6284/)
  console.log('PASS: Nulu model discovery, inference, streamed tools, file write, and session resume')
} finally {
  rmSync(workspace, { recursive: true, force: true, maxRetries: 3 })
}
