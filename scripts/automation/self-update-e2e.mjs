/** Install a packaged candidate, let it replace itself from a locally served release, and confirm the restarted application. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { appendFileSync, chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { _electron } from 'playwright-core'
import { command, git, json } from './common.mjs'
import { runInstaller } from './run-installer.mjs'

const [artifactDirectory, target, evidenceRoot] = process.argv.slice(2)
if (!artifactDirectory || !target || !evidenceRoot) throw new Error('Usage: self-update-e2e.mjs <artifact-directory> <target> <evidence-directory>')
const evidence = resolve(evidenceRoot)
mkdirSync(evidence, { recursive: true })
const suffix = { 'win-x64': 'win-x64.exe', 'linux-x64': 'linux-x86_64.AppImage', 'mac-arm64': 'mac-arm64.zip', 'mac-x64': 'mac-x64.zip' }[target]
if (!suffix) throw new Error(`Unsupported self-update target ${target}`)
const assets = readdirSync(resolve(artifactDirectory)).filter(name => name.endsWith(`-${suffix}`))
if (assets.length !== 1) throw new Error(`Expected one ${suffix} release asset in ${artifactDirectory}`)
const asset = resolve(artifactDirectory, assets[0])
const version = json('package.json').version
// NSIS file operations retain MAX_PATH; keep the private root near normal installation depth.
// The reopened process reports its resolved path: no 8.3 short names on Windows, no /var alias on macOS.
const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'nulu-')))
const home = join(root, 'home')
const installation = join(root, 'app')
mkdirSync(home)
mkdirSync(installation)
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/KEY|TOKEN|SECRET|PASSWORD|ELECTRON_RUN_AS_NODE/.test(name)))
env.NULU_HOME = home
env.NULU_TELEMETRY_DISABLED = '1'
// Hosted Linux runners provide no FUSE; the AppImage runtime still names its own file in APPIMAGE.
if (process.platform === 'linux') env.APPIMAGE_EXTRACT_AND_RUN = '1'
const notices = join(evidence, `${target}-self-update-dialogs.log`)
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex')

/** Lay down the candidate the way a user installs it and mark it as distinguishable from the release. */
async function install() {
  if (process.platform === 'win32') {
    await runInstaller(asset, ['/S', `/D=${installation}`], { evidence })
    return { executable: join(installation, 'Nulu Harness.exe'), marker: join(installation, 'resources', 'self-update-marker') }
  }
  if (process.platform === 'linux') {
    const executable = join(installation, 'Nulu-Harness.AppImage')
    copyFileSync(asset, executable)
    chmodSync(executable, 0o755)
    // Bytes after the embedded filesystem are ignored at launch and make the installed file differ from the release.
    appendFileSync(executable, 'installed-before-self-update')
    return { executable }
  }
  command('/usr/bin/ditto', ['-x', '-k', asset, installation])
  const bundle = join(installation, 'Nulu Harness.app')
  return { executable: join(bundle, 'Contents/MacOS/Nulu Harness'), bundle, marker: join(bundle, 'Contents/Resources/self-update-marker') }
}

/** Main application processes started from the installation, excluding Electron helpers and the restart waiter. */
function running(executable) {
  if (process.platform === 'win32') {
    const output = command('powershell', ['-NoProfile', '-Command',
      'Get-CimInstance Win32_Process -Filter "Name=\'Nulu Harness.exe\'" | ForEach-Object { "$($_.ProcessId)`t$($_.CommandLine)" }'])
    return output.split(/\r?\n/).map(line => line.split('\t')).filter(([pid, args]) => pid && args
      && args.toLowerCase().includes(executable.toLowerCase()) && !args.includes('--type=')).map(([pid]) => Number(pid))
  }
  return command('ps', ['-axo', 'pid=,args=']).split('\n').map(line => /^\s*(\d+)\s+(.*)$/.exec(line))
    .filter(entry => entry && entry[2].startsWith(executable) && !entry[2].includes('--type=')).map(entry => Number(entry[1]))
}

/** Every process whose command line names the product, for a failed restart diagnosis. */
function processes() {
  try {
    return process.platform === 'win32'
      ? command('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match "nulu" } | ForEach-Object { "$($_.ProcessId)`t$($_.CommandLine)" }'])
      : command('ps', ['-axo', 'pid=,args=']).split('\n').filter(line => /nulu/i.test(line)).join('\n')
  } catch (error) { return `process list unavailable: ${error.message}` }
}

function stop(executable, bundle) {
  if (process.platform === 'win32') {
    for (const pid of running(executable)) command('taskkill', ['/F', '/T', '/PID', String(pid)])
  } else if (process.platform === 'darwin') {
    try { command('pkill', ['-KILL', '-f', bundle]) } catch (error) { if (error.status !== 1) throw error }
  } else {
    for (const pid of running(executable)) {
      // The detached restart waiter leads the session that the reopened AppImage and its children inherit.
      const session = command('ps', ['-o', 'sid=', '-p', String(pid)]).trim()
      try { command('pkill', ['-KILL', '-s', session]) } catch (error) { if (error.status !== 1) throw error }
    }
  }
}

async function launch(executable, label) {
  const application = await _electron.launch({ executablePath: executable, args: [`--user-data-dir=${join(home, 'browser-data')}`], env, timeout: 180000 })
  const reported = await application.evaluate(({ app }) => app.getVersion())
  assert.equal(reported, version, 'The packaged application must report the candidate version')
  const window = await application.firstWindow({ timeout: 120000 })
  await window.waitForURL(url => url.protocol === 'nulu-app:' && url.hostname === 'app', { timeout: 120000 })
  await window.screenshot({ path: join(evidence, `${target}-self-update-${label}.png`) })
  return application
}

const result = { schemaVersion: 1, target, version, source: git(['rev-parse', 'HEAD']) }
let installed
try {
  installed = await install()
  const { executable, bundle, marker } = installed
  assert.ok(existsSync(executable), 'Installation did not produce the application executable')
  if (marker) writeFileSync(marker, 'installed-before-self-update')
  const release = 'https://platform.nuluai.com/downloads/harness'
  const feed = { release, name: `nulu-harness-99.0.0-${suffix}`, file: asset, size: statSync(asset).size, sha256: sha256(asset), notices }

  const application = await launch(executable, 'before')
  // Playwright reports close only after every inherited output pipe closes; the process exit is the fact under test.
  const closed = new Promise(accept => { application.process().once('exit', accept) })
  const previous = running(executable)
  await application.evaluate(({ Menu, dialog }, served) => {
    const fs = process.getBuiltinModule('node:fs')
    const { Readable } = process.getBuiltinModule('node:stream')
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      if (url === `${served.release}/nulu-release.json`) return Response.json({ schemaVersion: 1, version: '99.0.0', downloads: [] })
      if (url === `${served.release}/SHA256SUMS-99.0.0`) return new Response(`${served.sha256}  ${served.name}\n`)
      if (url === `${served.release}/${served.name}`) {
        return new Response(Readable.toWeb(fs.createReadStream(served.file)), { headers: { 'content-length': String(served.size) } })
      }
      return originalFetch(input, init)
    }
    // The disposable process owns these hooks until it exits; only the offer of the served release is accepted.
    dialog.showMessageBox = async (...args) => {
      const options = args.at(-1)
      const offered = `${options.detail ?? ''}`.includes('99.0.0')
      fs.appendFileSync(served.notices, `${offered ? 'accepted' : 'dismissed'}: ${options.title ?? ''} | ${options.message ?? ''} | ${options.detail ?? ''}\n`)
      return { response: offered ? 0 : 1, checkboxChecked: false }
    }
    const items = Menu.getApplicationMenu()?.items.flatMap(item => item.submenu?.items ?? []) ?? []
    const check = items.find(item => /updates|actualizaciones|更新/i.test(item.label))
    if (!check) throw new Error('The packaged update menu is missing')
    check.click(check)
  }, feed)

  console.info(`${target}: waiting for the application to download, replace itself and exit`)
  const exited = await Promise.race([closed.then(() => true), delay(15 * 60_000, false)])
  const dialogs = existsSync(notices) ? readFileSync(notices, 'utf8') : ''
  console.info(dialogs)
  assert.equal(exited, true, 'The application did not exit to install the offered release')
  assert.match(dialogs, /^accepted: .*99\.0\.0/m, 'The installed application must offer the newer release')
  assert.doesNotMatch(dialogs, /^dismissed: /m, 'The update must not report a failure or a second question')

  console.info(`${target}: waiting for the replaced application to start`)
  let restarted = []
  for (const deadline = Date.now() + 20 * 60_000; Date.now() < deadline && restarted.length === 0; await delay(1000)) {
    restarted = running(executable).filter(pid => !previous.includes(pid))
  }
  if (restarted.length === 0) console.error(processes())
  assert.notEqual(restarted.length, 0, 'The replaced application did not start by itself')
  await delay(10_000)
  assert.notEqual(running(executable).length, 0, 'The restarted application exited during startup')
  result.restarted = 'passed'

  if (process.platform === 'linux') assert.equal(sha256(executable), feed.sha256, 'The AppImage must hold the release bytes')
  if (process.platform === 'darwin') {
    assert.equal(existsSync(marker), false, 'The bundle must be the one from the release archive')
    const staging = readdirSync(installation).filter(name => name.startsWith('.nulu-harness-update-'))
    assert.equal(staging.length, 1, 'The replaced bundle must remain until the next launch')
    assert.ok(existsSync(join(installation, staging[0], 'previous.app', 'Contents/Resources/self-update-marker')))
  }
  // The NSIS uninstaller owns which unknown files it removes; record it without making it a requirement.
  if (process.platform === 'win32') result.markerRemoved = !existsSync(marker)
  result.replaced = 'passed'

  stop(executable, bundle)
  await delay(5000)
  const reopened = await launch(executable, 'after')
  await reopened.close()
  result.reopened = 'passed'
  writeFileSync(join(evidence, `${target}-self-update.json`), `${JSON.stringify(result, null, 2)}\n`)
  console.info(`${target}: self-update replaced the installation and restarted version ${version}`)
} finally {
  if (installed) try { stop(installed.executable, installed.bundle) } catch (error) { console.error(error) }
  // Cleanup must not replace the failure that explains this run.
  try { rmSync(root, { recursive: true, force: true, maxRetries: 3 }) } catch (error) { console.error(error) }
}
