/** Install published Nulu releases from the Nulu download host in place when the package carries no signed Electron update feed. */

import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { accessSync, constants, createWriteStream, existsSync } from 'node:fs'
import { chmod, mkdtemp, readdir, rename, rm } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import { promisify } from 'node:util'
import { fetchLatestRelease, isNewerVersion, releaseOrigin, type ReleaseInfo } from './release-feed.ts'

/** Updater operations the update coordinator calls; electron-updater's `AppUpdater` also satisfies them. */
export interface DesktopReleaseUpdater {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkForUpdates(): Promise<{
    readonly isUpdateAvailable: boolean
    readonly updateInfo: { readonly version: string }
  } | null>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

/** Process facts that decide whether and how this installation can replace itself. */
export interface SelfUpdateHost {
  readonly platform: NodeJS.Platform
  readonly arch: string
  /** Main executable of the running application. */
  readonly execPath: string
  readonly env: NodeJS.ProcessEnv
  /** Directory for a downloaded Windows installer. */
  readonly tempDirectory: string
}

/** One installation that can be replaced by a published release asset. */
export type SelfUpdateTarget =
  | {
    readonly kind: 'windows-installer'
    readonly assetSuffix: string
    readonly stagingRoot: string
  }
  | {
    readonly kind: 'linux-appimage'
    readonly assetSuffix: string
    readonly stagingRoot: string
    /** The AppImage file the user launches. */
    readonly appImage: string
    /** Mounted or extracted application directory that the AppImage runtime removes after the application exits. */
    readonly applicationDirectory: string | undefined
  }
  | {
    readonly kind: 'mac-bundle'
    readonly assetSuffix: string
    readonly stagingRoot: string
    /** The installed `.app` directory. */
    readonly bundle: string
    /** File name of the main executable inside `Contents/MacOS`. */
    readonly executable: string
  }

/** Directory-name prefix of download and replacement work; leftovers are deleted on the next check. */
export const SELF_UPDATE_STAGING_PREFIX = '.nulu-harness-update-'

const DOWNLOAD_TIMEOUT_MS = 60 * 60_000
/**
 * Waits at most two minutes for the old process to exit and thirty seconds for its AppImage runtime to remove
 * the application directory, then starts the replacement. An AppImage extracted without FUSE reuses one
 * directory per file path, so a replacement started earlier would have its files deleted by the old runtime.
 */
const RESTART_AFTER_EXIT = [
  'i=0; while kill -0 "$1" 2>/dev/null && [ "$i" -lt 600 ]; do sleep 0.2; i=$((i+1)); done',
  'i=0; while [ -n "$2" ] && [ -e "$2" ] && [ "$i" -lt 150 ]; do sleep 0.2; i=$((i+1)); done',
  'shift 2; exec "$@"',
].join('; ')

function writable(...paths: string[]): boolean {
  try {
    for (const path of paths) accessSync(path, constants.W_OK)
    return true
  }
  catch {
    return false
  }
}

/**
 * Select the release asset and replacement method for the running installation.
 * @param host - platform, executable location, and environment of the running application.
 * @returns the replacement method, or undefined when this installation must be updated by downloading an installer.
 */
export function resolveSelfUpdateTarget(host: SelfUpdateHost): SelfUpdateTarget | undefined {
  if (host.platform === 'win32' && host.arch === 'x64') {
    return { kind: 'windows-installer', assetSuffix: 'win-x64.exe', stagingRoot: host.tempDirectory }
  }
  if (host.platform === 'linux' && host.arch === 'x64') {
    // Only a launched AppImage names a single replaceable file; an extracted tree does not.
    const appImage = host.env.APPIMAGE
    if (appImage === undefined || !isAbsolute(appImage) || !existsSync(appImage)) return undefined
    const stagingRoot = dirname(appImage)
    if (!writable(stagingRoot)) return undefined
    return {
      kind: 'linux-appimage',
      assetSuffix: 'linux-x86_64.AppImage',
      stagingRoot,
      appImage,
      applicationDirectory: host.env.APPDIR,
    }
  }
  if (host.platform === 'darwin' && (host.arch === 'arm64' || host.arch === 'x64')) {
    const bundle = resolve(host.execPath, '../../..')
    // Gatekeeper runs an unmoved download from a read-only randomized copy that cannot be replaced.
    if (!bundle.endsWith('.app') || bundle.includes('/AppTranslocation/')) return undefined
    const stagingRoot = dirname(bundle)
    if (!writable(stagingRoot, bundle)) return undefined
    return {
      kind: 'mac-bundle',
      assetSuffix: `mac-${host.arch}.zip`,
      stagingRoot,
      bundle,
      executable: basename(host.execPath),
    }
  }
  return undefined
}

/** Collaborators of one self-updating installation; tests replace the process and network operations. */
export interface ReleaseSelfUpdaterOptions {
  readonly target: SelfUpdateTarget
  /** Version of the running application. */
  readonly currentVersion: string
  /** Ends the running application after its replacement is arranged. */
  readonly quit: () => void
  /** Reports the downloaded fraction, then undefined when the download ends. */
  readonly onProgress?: (fraction: number | undefined) => void
  readonly pid?: number
  readonly env?: NodeJS.ProcessEnv
  readonly fetchRelease?: () => Promise<ReleaseInfo | null>
  readonly fetch?: typeof fetch
  readonly spawn?: typeof spawn
  /** Expands a macOS release archive into an empty directory. */
  readonly extractArchive?: (archive: string, destination: string) => Promise<void>
}

async function extractWithDitto(archive: string, destination: string): Promise<void> {
  // ditto restores the symlinks, permissions, and extended attributes of an application bundle.
  await promisify(execFile)('/usr/bin/ditto', ['-x', '-k', archive, destination])
}

/**
 * Downloads the release file for this installation from the Nulu download host, verifies it against that
 * version's published SHA-256 list, replaces the installation, and restarts the application.
 */
export class ReleaseSelfUpdater implements DesktopReleaseUpdater {
  autoDownload = false
  autoInstallOnAppQuit = false
  private availableVersion: string | undefined
  private restart: (() => void) | undefined

  /** @param options - installation, running version, and replaceable process and network operations. */
  constructor(private readonly options: ReleaseSelfUpdaterOptions) {}

  /**
   * Compare the newest published release with the running version.
   * @returns the newer version, or null when none is published or the release list is unreachable.
   */
  async checkForUpdates(): ReturnType<DesktopReleaseUpdater['checkForUpdates']> {
    await this.removeLeftovers()
    const release = await (this.options.fetchRelease ?? fetchLatestRelease)()
    if (release === null || !isNewerVersion(this.options.currentVersion, release.version)) {
      this.availableVersion = undefined
      return null
    }
    this.availableVersion = release.version
    return { isUpdateAvailable: true, updateInfo: { version: release.version } }
  }

  /**
   * Download and verify the checked release, then put it in place of the running installation.
   * A failure leaves the running installation unchanged.
   * @returns the path that now holds the release.
   */
  async downloadUpdate(): Promise<string[]> {
    const version = this.availableVersion
    if (version === undefined) throw new Error('desktop update: no newer release has been checked')
    const { target } = this.options
    const env = this.options.env ?? process.env
    const asset = `nulu-harness-${version}-${target.assetSuffix}`
    const release = releaseOrigin(env)
    await this.removeLeftovers()
    const staging = await mkdtemp(join(target.stagingRoot, SELF_UPDATE_STAGING_PREFIX))
    try {
      const file = join(staging, asset)
      await this.download(`${release}/${asset}`, file, await this.publishedDigest(`${release}/SHA256SUMS-${version}`, asset))
      const installed = await this.install(file, staging)
      this.availableVersion = undefined
      return [installed]
    }
    catch (error) {
      await rm(staging, { recursive: true, force: true }).catch(() => undefined)
      throw error
    }
    finally {
      this.options.onProgress?.(undefined)
    }
  }

  /** Start the replaced installation once this process has ended, then end this process. */
  quitAndInstall(): void {
    const restart = this.restart
    if (restart === undefined) throw new Error('desktop update: no downloaded release is ready')
    this.restart = undefined
    restart()
    this.options.quit()
  }

  private request(url: string): Promise<Response> {
    // Resolved per call: packaged-application checks replace the global function.
    return (this.options.fetch ?? fetch)(url, {
      headers: { 'user-agent': 'nulu-harness-desktop' },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    })
  }

  private async publishedDigest(checksums: string, asset: string): Promise<string> {
    const response = await this.request(checksums)
    if (!response.ok) throw new Error(`desktop update: release checksums returned HTTP ${response.status}`)
    for (const line of (await response.text()).split('\n')) {
      const entry = /^([a-f0-9]{64}) [ *](.+)$/.exec(line.trim())
      if (entry?.[2] === asset) return entry[1] as string
    }
    throw new Error(`desktop update: the release publishes no checksum for ${asset}`)
  }

  private async download(url: string, file: string, digest: string): Promise<void> {
    const response = await this.request(url)
    if (!response.ok || response.body === null) {
      throw new Error(`desktop update: release download returned HTTP ${response.status}`)
    }
    const total = Number(response.headers.get('content-length'))
    const hash = createHash('sha256')
    let received = 0
    const measure = new Transform({
      transform: (chunk: Buffer, _encoding, forward) => {
        hash.update(chunk)
        received += chunk.length
        if (total > 0) this.options.onProgress?.(Math.min(received / total, 1))
        forward(null, chunk)
      },
    })
    await pipeline(Readable.fromWeb(response.body as ReadableStream), measure, createWriteStream(file))
    if (hash.digest('hex') !== digest) {
      throw new Error('desktop update: the downloaded release does not match its published checksum')
    }
  }

  private async install(file: string, staging: string): Promise<string> {
    const { target } = this.options
    const start = this.options.spawn ?? spawn
    const detached = { detached: true, stdio: 'ignore' } as const
    if (target.kind === 'windows-installer') {
      this.restart = () => {
        // The installer closes this application, replaces the registered installation, and starts it again.
        const installer = start(file, ['--updated', '/S', '--force-run'], detached)
        installer.on('error', (error) => { console.error(error) })
        installer.unref()
      }
      return file
    }
    const afterExit = (removed: string | undefined, command: string[]): void => {
      const waiter = start('/bin/sh', [
        '-c', RESTART_AFTER_EXIT, 'nulu-harness-update', String(this.options.pid ?? process.pid), removed ?? '', ...command,
      ], { ...detached, cwd: '/' })
      waiter.on('error', (error) => { console.error(error) })
      waiter.unref()
    }
    if (target.kind === 'linux-appimage') {
      await chmod(file, 0o755)
      // The running application keeps its mounted file open; the path now names the new release.
      await rename(file, target.appImage)
      await rm(staging, { recursive: true, force: true })
      this.restart = () => { afterExit(target.applicationDirectory, [target.appImage]) }
      return target.appImage
    }
    const payload = join(staging, 'payload')
    await (this.options.extractArchive ?? extractWithDitto)(file, payload)
    const bundles = (await readdir(payload)).filter(name => name.endsWith('.app'))
    const replacement = bundles.length === 1 ? join(payload, bundles[0] as string) : undefined
    if (replacement === undefined || !existsSync(join(replacement, 'Contents', 'MacOS', target.executable))) {
      throw new Error('desktop update: the release archive does not contain the application')
    }
    await rm(file, { force: true })
    // The replaced bundle stays in the staging directory until the next launch deletes it.
    const previous = join(staging, 'previous.app')
    await rename(target.bundle, previous)
    try {
      await rename(replacement, target.bundle)
    }
    catch (error) {
      await rename(previous, target.bundle)
      throw error
    }
    this.restart = () => { afterExit(undefined, ['/usr/bin/open', '-n', target.bundle]) }
    return target.bundle
  }

  private async removeLeftovers(): Promise<void> {
    const root = this.options.target.stagingRoot
    const names = await readdir(root).catch(() => [])
    await Promise.all(names.filter(name => name.startsWith(SELF_UPDATE_STAGING_PREFIX))
      .map(name => rm(join(root, name), { recursive: true, force: true }).catch(() => undefined)))
  }
}
