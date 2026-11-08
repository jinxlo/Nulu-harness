/** A throwaway npm registry that holds local tarballs and reads every other package from the public registry. */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const windows = process.platform === 'win32'

/**
 * Find a free loopback port.
 * @returns the port number.
 */
export async function freePort() {
  const server = createServer()
  await new Promise(accept => server.listen(0, '127.0.0.1', accept))
  const { port } = server.address()
  await new Promise(accept => server.close(accept))
  return port
}

/**
 * Stop a child process and everything it started.
 * @param child - the process, started detached outside Windows.
 */
export function stopTree(child) {
  if (child.exitCode !== null) return
  if (windows) spawnSync('taskkill', ['/F', '/T', '/PID', String(child.pid)])
  else { try { process.kill(-child.pid, 'SIGKILL') } catch { child.kill('SIGKILL') } }
}

/**
 * Start Verdaccio in `root` and publish `tarballs` to it.
 * @param root - empty directory that holds the registry storage and configuration.
 * @param tarballs - absolute tarball paths to publish.
 * @param env - environment for the registry and npm; it must not carry credentials.
 * @returns the registry `url`, the npm arguments `args` that address it, and `stop()`.
 */
export async function startLocalRegistry(root, tarballs, env) {
  mkdirSync(root, { recursive: true })
  const port = await freePort()
  const url = `http://127.0.0.1:${port}/`
  writeFileSync(join(root, 'registry.yaml'), [
    `storage: ${JSON.stringify(join(root, 'storage'))}`,
    'uplinks:', '  npmjs:', '    url: https://registry.npmjs.org/',
    // Release packages resolve only to the local tarballs, even when the public registry already has that version.
    'packages:',
    "  '@worldapptechnologies/nulu':", '    access: $all', '    publish: $all',
    "  '@worldapptechnologies/nulu-*':", '    access: $all', '    publish: $all',
    "  'nulu-harness':", '    access: $all', '    publish: $all',
    "  '**':", '    access: $all', '    publish: $all', '    proxy: npmjs',
    'max_body_size: 500mb',
    'log: { type: stdout, format: pretty, level: warn }',
    '',
  ].join('\n'))
  const registry = spawn('npx', ['--yes', 'verdaccio@6', '--config', join(root, 'registry.yaml'), '--listen', `127.0.0.1:${port}`], { env, shell: windows, stdio: 'ignore', detached: !windows })
  const stop = () => stopTree(registry)
  try {
    for (let attempt = 0; ; attempt += 1) {
      try { if ((await fetch(`${url}-/ping`)).ok) break } catch { /* the registry is still starting */ }
      if (attempt > 180) throw new Error('The local registry did not start')
      await delay(1000)
    }
    const args = ['--registry', url, `--//127.0.0.1:${port}/:_authToken=local-check`]
    let next = 0
    const publishOne = async () => {
      for (let index = next++; index < tarballs.length; index = next++) {
        const published = await new Promise(accept => {
          const child = spawn('npm', ['publish', tarballs[index], ...args, '--loglevel=error'], { env, shell: windows, stdio: ['ignore', 'ignore', 'pipe'] })
          let stderr = ''
          child.stderr.on('data', chunk => { stderr += chunk })
          child.on('close', code => accept({ code, stderr }))
        })
        if (published.code !== 0) throw new Error(`Could not publish ${tarballs[index]} to the local registry: ${published.stderr.slice(-600)}`)
      }
    }
    await Promise.all(Array.from({ length: 8 }, publishOne))
    return { url, args, stop }
  } catch (error) {
    stop()
    throw error
  }
}
