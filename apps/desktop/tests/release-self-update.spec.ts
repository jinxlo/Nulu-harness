import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ReleaseSelfUpdater,
  resolveSelfUpdateTarget,
  SELF_UPDATE_STAGING_PREFIX,
  type ReleaseSelfUpdaterOptions,
  type SelfUpdateTarget,
} from '../src/release-self-update.ts'

const roots: string[] = []
function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'nulu-self-update-test-'))
  roots.push(root)
  return root
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const release = 'https://platform.nuluai.com/downloads/harness'
const published = { version: '2.0.0', url: 'https://www.nuluai.com/harness' }

/** Serve one release asset and its checksum list; `listed` overrides the published digest. */
function releaseServer(asset: string, bytes: Buffer, listed?: string): { fetch: typeof fetch; requests: string[] } {
  const requests: string[] = []
  const digest = listed ?? createHash('sha256').update(bytes).digest('hex')
  return {
    requests,
    fetch: async (input: Parameters<typeof fetch>[0]) => {
      const url = input as string
      requests.push(url)
      if (url === `${release}/SHA256SUMS-2.0.0`) return new Response(`${'0'.repeat(64)}  other-file\n${digest}  ${asset}\n`)
      if (url === `${release}/${asset}`) return new Response(new Uint8Array(bytes), { headers: { 'content-length': String(bytes.length) } })
      return new Response('missing', { status: 404 })
    },
  }
}

function updater(target: SelfUpdateTarget, options: Partial<ReleaseSelfUpdaterOptions> = {}): ReleaseSelfUpdater {
  return new ReleaseSelfUpdater({
    target,
    currentVersion: '1.0.0',
    quit: () => {},
    env: {},
    fetchRelease: async () => published,
    ...options,
  })
}

describe('self-update target', () => {
  it('uses the Windows installer for every x64 Windows installation', () => {
    expect(resolveSelfUpdateTarget({ platform: 'win32', arch: 'x64', execPath: 'C:\\Nulu\\Nulu Harness.exe', env: {}, tempDirectory: 'C:\\Temp' }))
      .toEqual({ kind: 'windows-installer', assetSuffix: 'win-x64.exe', stagingRoot: 'C:\\Temp' })
  })

  it('replaces a launched AppImage and refuses an extracted Linux tree', () => {
    const root = temporaryRoot()
    const appImage = join(root, 'Nulu.AppImage')
    writeFileSync(appImage, 'old')
    const host = { platform: 'linux' as const, arch: 'x64', execPath: '/tmp/.mount/nulu-harness', tempDirectory: tmpdir() }
    expect(resolveSelfUpdateTarget({ ...host, env: { APPIMAGE: appImage, APPDIR: '/tmp/.mount_nulu' } }))
      .toEqual({ kind: 'linux-appimage', assetSuffix: 'linux-x86_64.AppImage', stagingRoot: root, appImage, applicationDirectory: '/tmp/.mount_nulu' })
    expect(resolveSelfUpdateTarget({ ...host, env: {} })).toBeUndefined()
    expect(resolveSelfUpdateTarget({ ...host, env: { APPIMAGE: join(root, 'absent.AppImage') } })).toBeUndefined()
  })

  it('replaces a writable macOS bundle and refuses a translocated copy', () => {
    const root = temporaryRoot()
    const bundle = join(root, 'Nulu Harness.app')
    mkdirSync(join(bundle, 'Contents/MacOS'), { recursive: true })
    const host = { platform: 'darwin' as const, env: {}, tempDirectory: tmpdir() }
    expect(resolveSelfUpdateTarget({ ...host, arch: 'arm64', execPath: join(bundle, 'Contents/MacOS/Nulu Harness') }))
      .toEqual({ kind: 'mac-bundle', assetSuffix: 'mac-arm64.zip', stagingRoot: root, bundle, executable: 'Nulu Harness' })
    expect(resolveSelfUpdateTarget({ ...host, arch: 'x64', execPath: '/private/var/folders/x/AppTranslocation/1/d/Nulu Harness.app/Contents/MacOS/Nulu Harness' }))
      .toBeUndefined()
    expect(resolveSelfUpdateTarget({ ...host, arch: 'x64', execPath: '/absent-volume/Nulu Harness.app/Contents/MacOS/Nulu Harness' }))
      .toBeUndefined()
  })

  it('leaves unsupported platforms to the download notice', () => {
    expect(resolveSelfUpdateTarget({ platform: 'linux', arch: 'arm64', execPath: '/x', env: { APPIMAGE: '/x' }, tempDirectory: tmpdir() })).toBeUndefined()
  })
})

describe('release self-updater', () => {
  it('reports only a newer published release', async () => {
    const target: SelfUpdateTarget = { kind: 'windows-installer', assetSuffix: 'win-x64.exe', stagingRoot: temporaryRoot() }
    await expect(updater(target).checkForUpdates()).resolves.toEqual({ isUpdateAvailable: true, updateInfo: { version: '2.0.0' } })
    await expect(updater(target, { currentVersion: '2.0.0' }).checkForUpdates()).resolves.toBeNull()
    await expect(updater(target, { fetchRelease: async () => null }).checkForUpdates()).resolves.toBeNull()
    await expect(updater(target).downloadUpdate()).rejects.toThrow(/no newer release/u)
  })

  it('runs the verified Windows installer silently and restarts through it', async () => {
    const root = temporaryRoot()
    mkdirSync(join(root, `${SELF_UPDATE_STAGING_PREFIX}stale`))
    const bytes = Buffer.from('installer')
    const server = releaseServer('nulu-harness-2.0.0-win-x64.exe', bytes)
    const child = { on: vi.fn(), unref: vi.fn() }
    const start = vi.fn(() => child)
    const quit = vi.fn()
    const progress: (number | undefined)[] = []
    const subject = updater({ kind: 'windows-installer', assetSuffix: 'win-x64.exe', stagingRoot: root }, {
      fetch: server.fetch, spawn: start as unknown as typeof spawn, quit, onProgress: (fraction) => { progress.push(fraction) },
    })
    await subject.checkForUpdates()
    const [installer] = await subject.downloadUpdate()
    expect(readFileSync(installer as string)).toEqual(bytes)
    expect(readdirSync(root)).toHaveLength(1)
    expect(progress).toEqual([1, undefined])
    expect(start).not.toHaveBeenCalled()
    subject.quitAndInstall()
    expect(start).toHaveBeenCalledWith(installer, ['--updated', '/S', '--force-run'], { detached: true, stdio: 'ignore' })
    expect(quit).toHaveBeenCalledOnce()
    expect(() => { subject.quitAndInstall() }).toThrow(/no downloaded release/u)
  })

  it('rejects a download that differs from the published checksum and keeps the installation', async () => {
    const root = temporaryRoot()
    const appImage = join(root, 'Nulu.AppImage')
    writeFileSync(appImage, 'old')
    const target: SelfUpdateTarget = { kind: 'linux-appimage', assetSuffix: 'linux-x86_64.AppImage', stagingRoot: root, appImage, applicationDirectory: undefined }
    const asset = 'nulu-harness-2.0.0-linux-x86_64.AppImage'
    for (const fetcher of [
      releaseServer(asset, Buffer.from('tampered'), 'a'.repeat(64)).fetch,
      releaseServer('another-asset', Buffer.from('new')).fetch,
    ]) {
      const subject = updater(target, { fetch: fetcher })
      await subject.checkForUpdates()
      await expect(subject.downloadUpdate()).rejects.toThrow(/checksum/u)
      expect(readFileSync(appImage, 'utf8')).toBe('old')
      expect(readdirSync(root)).toEqual(['Nulu.AppImage'])
      expect(() => { subject.quitAndInstall() }).toThrow(/no downloaded release/u)
    }
  })

  it.skipIf(process.platform === 'win32')('replaces the AppImage and starts it after the old process and its application directory are gone', async () => {
    const root = temporaryRoot()
    const appImage = join(root, 'Nulu.AppImage')
    const started = join(root, 'started')
    const applicationDirectory = join(temporaryRoot(), 'mounted')
    mkdirSync(applicationDirectory)
    writeFileSync(appImage, 'old')
    const replacement = Buffer.from(`#!/bin/sh\necho "$0" > '${started}'\n`)
    const server = releaseServer('nulu-harness-2.0.0-linux-x86_64.AppImage', replacement)
    const running = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' })
    const exited = new Promise((accept) => { running.once('exit', accept) })
    const subject = updater({ kind: 'linux-appimage', assetSuffix: 'linux-x86_64.AppImage', stagingRoot: root, appImage, applicationDirectory }, {
      fetch: server.fetch, pid: running.pid as number, quit: () => { setTimeout(() => { running.kill() }, 300) },
    })
    await subject.checkForUpdates()
    await expect(subject.downloadUpdate()).resolves.toEqual([appImage])
    expect(readFileSync(appImage)).toEqual(replacement)
    expect(statSync(appImage).mode & 0o777).toBe(0o755)
    expect(readdirSync(root)).toEqual(['Nulu.AppImage'])
    subject.quitAndInstall()
    await new Promise(accept => setTimeout(accept, 150))
    expect(existsSync(started)).toBe(false)
    await exited
    await new Promise(accept => setTimeout(accept, 600))
    expect(existsSync(started)).toBe(false)
    rmSync(applicationDirectory, { recursive: true })
    await vi.waitFor(() => { expect(readFileSync(started, 'utf8').trim()).toBe(appImage) }, { timeout: 10_000 })
  })

  it('swaps the macOS bundle, keeps the previous one until the next check, and reopens the application', async () => {
    const root = temporaryRoot()
    const bundle = join(root, 'Nulu Harness.app')
    mkdirSync(join(bundle, 'Contents/MacOS'), { recursive: true })
    writeFileSync(join(bundle, 'Contents/MacOS/Nulu Harness'), 'old')
    const target: SelfUpdateTarget = { kind: 'mac-bundle', assetSuffix: 'mac-arm64.zip', stagingRoot: root, bundle, executable: 'Nulu Harness' }
    const server = releaseServer('nulu-harness-2.0.0-mac-arm64.zip', Buffer.from('archive'))
    const extractArchive = vi.fn(async (_archive: string, destination: string) => {
      mkdirSync(join(destination, 'Nulu Harness.app/Contents/MacOS'), { recursive: true })
      writeFileSync(join(destination, 'Nulu Harness.app/Contents/MacOS/Nulu Harness'), 'new')
    })
    const child = { on: vi.fn(), unref: vi.fn() }
    const start = vi.fn(() => child)
    const subject = updater(target, { fetch: server.fetch, extractArchive, spawn: start as unknown as typeof spawn, pid: 4242 })
    await subject.checkForUpdates()
    await expect(subject.downloadUpdate()).resolves.toEqual([bundle])
    expect(readFileSync(join(bundle, 'Contents/MacOS/Nulu Harness'), 'utf8')).toBe('new')
    const [staging] = readdirSync(root).filter(name => name.startsWith(SELF_UPDATE_STAGING_PREFIX))
    expect(readFileSync(join(root, staging as string, 'previous.app/Contents/MacOS/Nulu Harness'), 'utf8')).toBe('old')
    subject.quitAndInstall()
    expect(start).toHaveBeenCalledWith('/bin/sh', [
      '-c', expect.stringContaining('kill -0'), 'nulu-harness-update', '4242', '', '/usr/bin/open', '-n', bundle,
    ], { detached: true, stdio: 'ignore', cwd: '/' })
    await updater(target, { currentVersion: '2.0.0' }).checkForUpdates()
    expect(readdirSync(root)).toEqual(['Nulu Harness.app'])
  })

  it('keeps the running macOS bundle when the archive lacks the application', async () => {
    const root = temporaryRoot()
    const bundle = join(root, 'Nulu Harness.app')
    mkdirSync(join(bundle, 'Contents/MacOS'), { recursive: true })
    writeFileSync(join(bundle, 'Contents/MacOS/Nulu Harness'), 'old')
    const server = releaseServer('nulu-harness-2.0.0-mac-x64.zip', Buffer.from('archive'))
    const subject = updater({ kind: 'mac-bundle', assetSuffix: 'mac-x64.zip', stagingRoot: root, bundle, executable: 'Nulu Harness' }, {
      fetch: server.fetch,
      extractArchive: async (_archive, destination) => { mkdirSync(join(destination, 'Other.app'), { recursive: true }) },
    })
    await subject.checkForUpdates()
    await expect(subject.downloadUpdate()).rejects.toThrow(/does not contain the application/u)
    expect(readFileSync(join(bundle, 'Contents/MacOS/Nulu Harness'), 'utf8')).toBe('old')
    expect(readdirSync(root)).toEqual(['Nulu Harness.app'])
  })
})
