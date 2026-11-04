/** Launch the packaged payload twice with an isolated persistent profile and check the rendered app. */
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron } from 'playwright-core'
import { git, json } from './common.mjs'

const [executable, target, evidenceRoot, previousExecutable, previousVersion] = process.argv.slice(2)
if (!executable || !target || !evidenceRoot) throw new Error('Usage: desktop-smoke.mjs <executable> <target> <evidence-directory>')
const evidence = resolve(evidenceRoot)
mkdirSync(evidence, { recursive: true })
const home = mkdtempSync(join(tmpdir(), 'nulu-release-smoke-'))
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/KEY|TOKEN|SECRET|PASSWORD|ELECTRON_RUN_AS_NODE/.test(name)))
env.NULU_HOME = home
env.NULU_TELEMETRY_DISABLED = '1'
const errors = []
try {
  const stages = [...(previousExecutable ? [{ executable: previousExecutable, version: previousVersion, label: 'previous' }] : []),
    { executable, version: json('package.json').version, label: 'upgrade' },
    { executable, version: json('package.json').version, label: 'restart' }]
  for (let attempt = 0; attempt < stages.length; attempt += 1) {
    const stage = stages[attempt]
    const application = await _electron.launch({ executablePath: resolve(stage.executable), env, timeout: 120000 })
    try {
      application.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
      const version = await application.evaluate(({ app }) => app.getVersion())
      assert.equal(version, stage.version, 'Packaged app version must match the release')
      const window = await application.firstWindow({ timeout: 120000 })
      await window.waitForURL(url => url.protocol === 'nulu-app:' && url.hostname === 'app', { timeout: 120000 })
      await window.waitForFunction(() => document.body.innerText.trim().length > 30, { timeout: 60000 })
      const text = await window.locator('body').innerText()
      assert.doesNotMatch(text, /DeepSeek Harness|DSH_|@deepseek-ai\//i)
      assert.doesNotMatch(text, /Desktop renderer exited|reinstall the application|startup failed/i)
      assert.match(await window.title(), /Nulu/i)
      await window.screenshot({ path: join(evidence, `${target}-${stage.label}.png`), fullPage: true })
      if (attempt === 0) {
        writeFileSync(join(home, 'release-smoke-sentinel'), 'preserved')
        await window.evaluate(() => localStorage.setItem('nulu-release-smoke', 'preserved'))
      } else {
        assert.equal(readFileSync(join(home, 'release-smoke-sentinel'), 'utf8'), 'preserved')
        assert.equal(await window.evaluate(() => localStorage.getItem('nulu-release-smoke')), 'preserved')
      }
    } finally {
      await application.close()
    }
  }
  writeFileSync(join(evidence, `${target}-evidence.json`), `${JSON.stringify({ schemaVersion: 1, target, version: json('package.json').version, source: git(['rev-parse', 'HEAD']), packagedLaunch: 'passed', profileRestart: 'passed', upgrade: previousExecutable ? 'passed' : 'not-tested', errors }, null, 2)}\n`)
} finally {
  rmSync(home, { recursive: true, force: true, maxRetries: 3 })
}
