/** Launch the packaged payload twice with an isolated persistent profile and check the rendered app. */
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { _electron } from 'playwright-core'
import { ROOT, command, git, json } from './common.mjs'

const [executable, target, evidenceRoot, previousExecutable, previousVersion, upgradeInstaller] = process.argv.slice(2)
if (!executable || !target || !evidenceRoot) throw new Error('Usage: desktop-smoke.mjs <executable> <target> <evidence-directory>')
const evidence = resolve(evidenceRoot)
mkdirSync(evidence, { recursive: true })
const home = mkdtempSync(join(tmpdir(), 'nulu-release-smoke-'))
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/KEY|TOKEN|SECRET|PASSWORD|ELECTRON_RUN_AS_NODE/.test(name)))
env.NULU_HOME = home
env.NULU_TELEMETRY_DISABLED = '1'
const errors = []
const geometry = /NULU_MARK_PATH\s*=\s*'([^']+)'/.exec(readFileSync(join(ROOT, 'packages/client/ui-primitives/src/NuluMark.tsx'), 'utf8'))?.[1]
assert.ok(geometry, 'The trusted Nulu mark must be available for visual identity verification')
try {
  const stages = [...(previousExecutable ? [{ executable: previousExecutable, version: previousVersion, label: 'previous' }] : []),
    { executable, version: json('package.json').version, label: 'upgrade' },
    { executable, version: json('package.json').version, label: 'restart' }]
  for (let attempt = 0; attempt < stages.length; attempt += 1) {
    const stage = stages[attempt]
    if (stage.label === 'upgrade' && upgradeInstaller !== undefined) {
      assert.equal(process.platform, 'win32', 'Only NSIS uses deferred in-place installation')
      command(resolve(upgradeInstaller), ['/S', `/D=${dirname(resolve(executable))}`], { timeout: 180000 })
    }
    const application = await _electron.launch({ executablePath: resolve(stage.executable), args: [`--user-data-dir=${join(home, 'browser-data')}`], env, timeout: 120000 })
    try {
      application.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
      const version = await application.evaluate(({ app }) => app.getVersion())
      assert.equal(version, stage.version, 'Packaged app version must match the release')
      const window = await application.firstWindow({ timeout: 120000 })
      window.on('pageerror', error => errors.push(error.message))
      await window.waitForURL(url => url.protocol === 'nulu-app:' && url.hostname === 'app', { timeout: 120000 })
      await window.waitForFunction(() => document.body.innerText.trim().length > 30, { timeout: 60000 })
      const text = await window.locator('body').innerText()
      assert.doesNotMatch(text, /DeepSeek Harness|DSH_|@deepseek-ai\//i)
      assert.doesNotMatch(text, /Desktop renderer exited|reinstall the application|startup failed/i)
      assert.match(await window.title(), /Nulu/i)
      await window.locator(`svg path[d="${geometry}"]`).first().waitFor({ state: 'visible', timeout: 30000 })
      await window.locator('svg text').filter({ hasText: /Nulu/ }).first().waitFor({ state: 'visible', timeout: 30000 })
      if (stage.label !== 'previous') {
        const notified = await application.evaluate(async ({ Menu, dialog }) => {
          const items = Menu.getApplicationMenu()?.items.flatMap(item => item.submenu?.items ?? []) ?? []
          const check = items.find(item => /updates|actualizaciones/i.test(item.label))
          if (!check) throw new Error('The packaged update menu is missing')
          const requests = []
          const notices = []
          const originalFetch = globalThis.fetch
          globalThis.fetch = async (input, init) => {
            const url = String(input)
            if (url.startsWith('https://api.github.com/repos/')) {
              requests.push(url)
              const release = { tag_name: 'v99.0.0', name: 'Nulu Harness 99.0.0', html_url: 'https://github.com/jinxlo/Nulu-harness/releases/tag/v99.0.0', published_at: '2026-11-04T00:00:00Z', draft: false, prerelease: false }
              return Response.json(url.includes('/latest') ? release : [release])
            }
            return originalFetch(input, init)
          }
          // The disposable process owns these hooks until close; no native dialog can outlive this check.
          dialog.showMessageBox = async (...args) => {
            const options = args.at(-1)
            notices.push(`${options.message ?? ''} ${options.detail ?? ''}`)
            return { response: 1, checkboxChecked: false }
          }
          check.click(check)
          await new Promise((accept, reject) => {
            const deadline = Date.now() + 30000
            const timer = setInterval(() => {
              if (notices.some(text => text.includes('99.0.0'))) { clearInterval(timer); accept() }
              else if (Date.now() > deadline) { clearInterval(timer); reject(new Error('Update menu did not offer the Nulu release')) }
            }, 50)
          })
          return requests.some(url => url.startsWith('https://api.github.com/repos/jinxlo/Nulu-harness/releases'))
        })
        assert.equal(notified, true, 'The installed update menu must use the Nulu release repository')
      }
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
  assert.deepEqual(errors, [], 'Packaged launch and upgrade must not emit JavaScript errors')
  writeFileSync(join(evidence, `${target}-evidence.json`), `${JSON.stringify({ schemaVersion: 1, target, version: json('package.json').version, source: git(['rev-parse', 'HEAD']), branding: 'passed', updateNotification: 'passed', packagedLaunch: 'passed', profileRestart: 'passed', upgrade: previousExecutable ? 'passed' : 'not-tested', errors }, null, 2)}\n`)
} finally {
  rmSync(home, { recursive: true, force: true, maxRetries: 3 })
}
