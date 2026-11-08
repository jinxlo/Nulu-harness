/**
 * Install `nulu-harness` the way a customer does and run it.
 *
 * The packed nulu-harness, which carries every Nulu Harness package, is published to a registry that exists only
 * for this run; everything else comes from the public npm registry. The check then performs `npm install -g nulu-harness` into an empty prefix and runs the
 * installed command: version, help, the local interface, and (with an API key) a task that edits a file and runs
 * a command through a Nulu AI model.
 *
 *   node cli-install-check.mjs <nulu-harness.tgz> <evidence-directory>
 */
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { freePort, startLocalRegistry, stopTree } from './local-registry.mjs'

const [wrapperTarball, evidenceRoot] = process.argv.slice(2)
if (!wrapperTarball || !evidenceRoot) throw new Error('Usage: cli-install-check.mjs <nulu-harness.tgz> <evidence-directory>')
const evidence = resolve(evidenceRoot)
mkdirSync(evidence, { recursive: true })
const windows = process.platform === 'win32'
const root = mkdtempSync(join(tmpdir(), 'nulu-cli-'))
const version = /nulu-harness-(\d+\.\d+\.\d+)\.tgz$/.exec(wrapperTarball)?.[1]
if (!version) throw new Error('The nulu-harness tarball does not name a stable version')
const apiKey = process.env.WORLD_APP_TECHNOLOGIES_API_KEY
// Installation, the registry and the interface never see the API key; only the model task does.
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/KEY|TOKEN|SECRET|PASSWORD|^npm_config_/i.test(name)))
env.NULU_HOME = join(root, 'home')
env.NULU_TELEMETRY_DISABLED = '1'
const result = { schemaVersion: 1, platform: `${process.platform}-${process.arch}`, node: process.version, version, checks: [] }
const record = (name, detail) => { result.checks.push({ name, status: 'passed', ...(detail === undefined ? {} : { detail }) }); console.info(`ok  ${name}${detail === undefined ? '' : `: ${detail}`}`) }

function run(executable, args, options = {}) {
  const completed = spawnSync(executable, args, { encoding: 'utf8', env, shell: windows, timeout: 15 * 60_000, maxBuffer: 64 * 1024 * 1024, ...options })
  if (completed.error) throw completed.error
  return completed
}

let registry
let interfaceProcess
try {
  // A registry for this run only: it holds the packed nulu-harness, and every other package comes from the public registry.
  registry = await startLocalRegistry(join(root, 'registry'), [resolve(wrapperTarball)], env)
  const registryArgs = registry.args
  record('nulu-harness published to a registry used only by this check', 'one package')

  const prefix = join(root, 'prefix')
  mkdirSync(prefix)
  const started = Date.now()
  const installed = run('npm', ['install', '-g', `nulu-harness@${version}`, '--prefix', prefix, ...registryArgs, '--no-audit', '--no-fund', '--loglevel=error'])
  assert.equal(installed.status, 0, `npm install -g nulu-harness failed:\n${installed.stdout}\n${installed.stderr}`)
  const nulu = windows ? join(prefix, 'nulu.cmd') : join(prefix, 'bin', 'nulu')
  assert.ok(existsSync(nulu), 'The global installation must provide the nulu command')
  record('npm install -g nulu-harness', `${Math.round((Date.now() - started) / 1000)} s`)

  const project = join(root, 'project')
  mkdirSync(join(project, 'src'), { recursive: true })
  writeFileSync(join(project, 'src', 'math.js'), 'export function add(a, b) {\n  return a - b\n}\n')
  writeFileSync(join(project, 'src', 'main.js'), 'import { add } from "./math.js"\nconsole.log("2 + 3 =", add(2, 3))\n')
  const inProject = { cwd: project }

  const reported = run(nulu, ['--version'], inProject)
  assert.equal(reported.stdout.trim(), version, `nulu --version: ${reported.stdout}${reported.stderr}`)
  record('nulu --version', version)

  const help = run(nulu, ['--help'], inProject)
  assert.equal(help.status, 0)
  assert.match(help.stdout, /Usage: nulu/)
  assert.match(help.stdout, /web \[options\]/)
  record('nulu --help lists the commands')

  // Without a terminal the bare command explains itself instead of failing or starting a server that never exits.
  const bare = run(nulu, [], { ...inProject, input: '' })
  assert.equal(bare.status, 0, `bare nulu exited ${bare.status}: ${bare.stderr}`)
  assert.match(bare.stdout, /Usage: nulu/)
  assert.doesNotMatch(`${bare.stdout}${bare.stderr}`, /--profile <name> is required/)
  record('nulu without arguments prints the command list when no terminal is attached')

  const port = await freePort()
  let output = ''
  interfaceProcess = spawn(nulu, ['web', '--no-open', '--port', String(port)], { ...inProject, env, shell: windows, detached: !windows })
  interfaceProcess.stdout.on('data', chunk => { output += chunk })
  interfaceProcess.stderr.on('data', chunk => { output += chunk })
  let address
  for (let attempt = 0; attempt < 120 && !address; attempt += 1) {
    address = /http:\/\/127\.0\.0\.1:\d+\/\?token=[\w-]+/.exec(output)?.[0]
    if (!address) await delay(1000)
  }
  assert.ok(address, `nulu web did not print its address:\n${output.slice(-1500)}`)
  const refused = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' })
  assert.equal(refused.status, 401, 'The interface must refuse a visit without its access code')
  // The access code is exchanged for a session cookie, then the visit continues without the code in the address.
  const admitted = await fetch(address, { redirect: 'manual' })
  const session = admitted.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ')
  assert.ok(admitted.status >= 300 && admitted.status < 400 && session, `The printed address must admit the visitor (HTTP ${admitted.status})`)
  const page = await fetch(new URL(admitted.headers.get('location') ?? '/', address), { headers: { cookie: session } })
  assert.equal(page.status, 200, 'The admitted visit must open the interface')
  assert.match(await page.text(), /<title>Nulu Harness<\/title>/)
  record('nulu web serves the interface at its printed address and refuses other visits')
  stopTree(interfaceProcess)
  interfaceProcess = undefined

  if (apiKey) {
    const task = run(nulu, ['--profile', 'headless', 'Run "node src/main.js". The printed sum is wrong: fix the bug in src/math.js, run the program again, and answer with the corrected output line only.'],
      { ...inProject, env: { ...env, WORLD_APP_TECHNOLOGIES_API_KEY: apiKey }, input: '', timeout: 10 * 60_000 })
    assert.equal(task.status, 0, `The model task failed:\n${task.stdout.slice(-1200)}\n${task.stderr.slice(-1200)}`)
    assert.match(readFileSync(join(project, 'src', 'math.js'), 'utf8'), /a \+ b/, 'The agent must have edited the file')
    const fixed = spawnSync(process.execPath, ['src/main.js'], { cwd: project, encoding: 'utf8' })
    assert.equal(fixed.stdout.trim(), '2 + 3 = 5')
    record('a Nulu AI model task ran a command, edited a file and fixed the program', task.stdout.trim().split('\n').at(-1).slice(0, 120))
  } else {
    result.checks.push({ name: 'Nulu AI model task', status: 'not-run', detail: 'no API key was supplied' })
    console.info('--  Nulu AI model task not run: no API key was supplied')
  }
  writeFileSync(join(evidence, `cli-install-${process.platform}-${process.arch}.json`), `${JSON.stringify(result, null, 2)}\n`)
  console.info(`nulu-harness ${version} installs and runs on ${result.platform}`)
} finally {
  if (interfaceProcess) stopTree(interfaceProcess)
  registry?.stop()
  try { rmSync(root, { recursive: true, force: true, maxRetries: 3 }) } catch (error) { console.error(error) }
}
