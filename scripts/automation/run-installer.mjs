/** Await the GUI installer itself without capturing pipes inherited by its helpers. */
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { ROOT, WINDOWS_INSTALL_TIMEOUT_MS } from './common.mjs'

const execute = promisify(execFile)

async function stopInstaller(child, evidence) {
  if (process.platform === 'win32') {
    if (evidence !== undefined && process.env.GITHUB_ACTIONS === 'true') {
      try {
        const { stdout } = await execute('powershell.exe', [
          '-NoLogo', '-NoProfile', '-NonInteractive', '-File',
          join(ROOT, 'scripts/automation/installer-diagnostics.ps1'),
          String(child.pid), evidence,
        ], { timeout: 30000, windowsHide: true })
        console.error(stdout.trim())
      } catch (error) {
        console.error(`Installer diagnostics failed: ${error.code ?? 'unknown error'}`)
      }
    }
    if (child.exitCode !== null || child.signalCode !== null) return
    try {
      await execute('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { timeout: 30000, windowsHide: true })
      return
    } catch (error) {
      console.error(`Installer process-tree termination failed: ${error.code ?? 'unknown error'}`)
    }
  }
  if (child.exitCode === null && child.signalCode === null) {
    if (process.platform !== 'win32') {
      try { process.kill(-child.pid, 'SIGKILL'); return }
      catch (error) { if (error.code !== 'ESRCH') console.error(`Installer group termination failed: ${error.code}`) }
    }
    child.kill('SIGKILL')
  }
}

/**
 * Run a silent installer while keeping the automation event loop responsive.
 * @param executable - delivered installer executable.
 * @param args - native installer arguments, with the destination last for NSIS.
 * @param options - bounded execution time and optional CI diagnostic directory.
 * @returns completion after installer exit and any timeout cleanup; failures reject.
 */
export async function runInstaller(executable, args, { timeout = WINDOWS_INSTALL_TIMEOUT_MS, evidence } = {}) {
  const child = spawn(executable, args, { stdio: 'ignore', windowsHide: true, detached: process.platform !== 'win32' })
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
  let termination
  let timedOut = false
  const deadline = setTimeout(() => {
    timedOut = true
    termination = stopInstaller(child, evidence)
  }, timeout)
  try {
    const result = await exited
    if (termination !== undefined) await termination
    if (timedOut || result.code !== 0) {
      throw Object.assign(new Error(timedOut ? 'Installer timed out' : `Installer exited ${result.code} (${result.signal ?? 'no signal'})`), {
        code: timedOut ? 'ETIMEDOUT' : 'INSTALLER_FAILED', exitCode: result.code, signal: result.signal,
      })
    }
  } finally {
    clearTimeout(deadline)
    if (termination !== undefined) await termination
  }
}
