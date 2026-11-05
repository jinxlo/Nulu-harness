/** Extract delivered installers, launch the previous release, and qualify the replacement against its profile. */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { command } from './common.mjs'

const [currentDirectory, previousDirectory, target, evidence] = process.argv.slice(2)
if (!currentDirectory || !previousDirectory || !target || !evidence) throw new Error('Usage: install-smoke.mjs <current-assets> <previous-assets> <target> <evidence>')
const root = mkdtempSync(join(tmpdir(), 'nulu-install-smoke-'))

function installerFor(directory) {
  const suffix = target === 'win-x64' ? '-win-x64.exe' : target === 'linux-x64' ? '-linux-x86_64.AppImage' : `-${target}.dmg`
  const names = readdirSync(directory).filter(name => name.endsWith(suffix))
  if (names.length !== 1) throw new Error(`Expected one ${target} installer in ${directory}`)
  return resolve(directory, names[0])
}

function unpack(directory, label) {
  const installer = installerFor(directory)
  const destination = join(root, label)
  mkdirSync(destination, { recursive: true })
  if (process.platform === 'linux') {
    command('chmod', ['+x', installer])
    command(installer, ['--appimage-extract'], { cwd: destination })
    return join(destination, 'squashfs-root/nulu-harness')
  }
  if (process.platform === 'win32') {
    command(installer, ['/S', `/D=${destination}`], { timeout: 180000 })
    return join(destination, 'Nulu Harness.exe')
  }
  const mount = join(root, `mount-${label}`)
  mkdirSync(mount)
  command('hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mount, installer])
  try { cpSync(join(mount, 'Nulu Harness.app'), join(destination, 'Nulu Harness.app'), { recursive: true, verbatimSymlinks: true }) }
  finally { command('hdiutil', ['detach', mount]) }
  return join(destination, 'Nulu Harness.app/Contents/MacOS/Nulu Harness')
}

try {
  const previous = unpack(resolve(previousDirectory), 'previous')
  // NSIS uninstalls the registered previous payload before installing its replacement.
  const upgradeInstaller = process.platform === 'win32' ? installerFor(resolve(currentDirectory)) : undefined
  const current = upgradeInstaller === undefined ? unpack(resolve(currentDirectory), 'current') : previous
  if (!existsSync(previous) || !existsSync(current)) throw new Error('Installer did not produce its application executable')
  const version = readdirSync(previousDirectory).map(name => /^nulu-harness-(\d+\.\d+\.\d+)-/.exec(name)?.[1]).find(Boolean)
  if (!version) throw new Error('Cannot determine the previous installer version')
  command(process.execPath, ['scripts/automation/desktop-smoke.mjs', current, target, resolve(evidence), previous, version, ...upgradeInstaller === undefined ? [] : [upgradeInstaller]], { stdio: 'inherit', timeout: 600000 })
} finally {
  rmSync(root, { recursive: true, force: true, maxRetries: 3 })
}
