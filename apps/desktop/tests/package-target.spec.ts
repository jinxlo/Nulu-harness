import { describe, expect, it } from 'vitest'
import {
  desktopElectronBuilderArguments,
  desktopElectronBuilderEnvironment,
  desktopTargetEnvironment,
  parseDesktopPackageInvocation,
  resolveDesktopPackageTarget,
  withoutDesktopUploadCredentials,
  withoutWindowsSigningEnvironment,
} from '../scripts/package-target.ts'

describe('desktop package target', () => {
  it('selects matching runtime and electron-builder architectures', () => {
    expect(resolveDesktopPackageTarget('mac-arm64', 'darwin', 'arm64')).toMatchObject({
      platform: 'darwin', arch: 'arm64', builderPlatform: '--mac', builderArch: '--arm64',
    })
    expect(resolveDesktopPackageTarget('mac-x64', 'darwin', 'x64')).toMatchObject({
      platform: 'darwin', arch: 'x64', builderPlatform: '--mac', builderArch: '--x64',
    })
    expect(resolveDesktopPackageTarget('win-x64', 'win32', 'x64')).toMatchObject({
      platform: 'win32', arch: 'x64', builderPlatform: '--win', builderArch: '--x64',
    })
    expect(resolveDesktopPackageTarget('linux-x64', 'linux', 'x64')).toMatchObject({
      platform: 'linux', arch: 'x64', builderPlatform: '--linux', builderArch: '--x64',
    })
  })

  it('allows an Apple Silicon host to build the Intel target through Rosetta', () => {
    expect(resolveDesktopPackageTarget('mac-x64', 'darwin', 'arm64').arch).toBe('x64')
  })

  it('rejects incompatible hosts before building', () => {
    expect(() => resolveDesktopPackageTarget('win-x64', 'darwin', 'arm64')).toThrow(/Windows x64/u)
    expect(() => resolveDesktopPackageTarget('mac-arm64', 'darwin', 'x64')).toThrow(/Apple Silicon/u)
    expect(() => resolveDesktopPackageTarget('mac-arm64', 'linux', 'arm64')).toThrow(/macOS/u)
    expect(() => resolveDesktopPackageTarget('mac-x64', 'darwin', 'ppc64')).toThrow(/Rosetta/u)
    expect(() => resolveDesktopPackageTarget('linux-x64', 'darwin', 'x64')).toThrow(/Linux x64/u)
    expect(() => resolveDesktopPackageTarget('linux-x64', 'linux', 'arm64')).toThrow(/Linux x64/u)
  })

  it('parses installer and unpacked-directory invocations', () => {
    expect(parseDesktopPackageInvocation(['mac-arm64'], 'darwin', 'arm64').directory).toBe(false)
    expect(parseDesktopPackageInvocation(['mac-arm64', '--dir'], 'darwin', 'arm64').directory).toBe(true)
    expect(parseDesktopPackageInvocation([], 'darwin', 'arm64').target.name).toBe('mac-arm64')
    expect(parseDesktopPackageInvocation(['--prepare-only'], 'darwin', 'arm64').prepareOnly).toBe(true)
    expect(() => parseDesktopPackageInvocation(['mac-arm64', 'mac-x64'], 'darwin', 'arm64'))
      .toThrow(/at most one target/u)
  })

  it('keeps electron-builder publishing disabled for the separate validated upload', () => {
    const target = resolveDesktopPackageTarget('mac-arm64', 'darwin', 'arm64')
    expect(desktopElectronBuilderArguments(target, false)).toEqual([
      'exec',
      'electron-builder',
      '--config',
      'electron-builder.config.mjs',
      '--mac',
      '--arm64',
      '--publish',
      'never',
    ])
    expect(desktopElectronBuilderArguments(target, true)).toContain('--dir')
  })

  it('accepts unsigned Windows and macOS artifacts and rejects Linux or preparation-only use', () => {
    expect(parseDesktopPackageInvocation(['win-x64', '--unsigned'], 'win32', 'x64').unsigned).toBe(true)
    expect(parseDesktopPackageInvocation(['mac-arm64', '--unsigned'], 'darwin', 'arm64').unsigned).toBe(true)
    expect(parseDesktopPackageInvocation(['win-x64'], 'win32', 'x64').unsigned).toBe(false)
    expect(parseDesktopPackageInvocation(['--unsigned', '--dir'], 'win32', 'x64')).toMatchObject({
      unsigned: true, directory: true,
    })
    expect(() => parseDesktopPackageInvocation(['linux-x64', '--unsigned'], 'linux', 'x64'))
      .toThrow(/Windows or macOS target/u)
    expect(() => parseDesktopPackageInvocation(['--unsigned', '--prepare-only'], 'win32', 'x64'))
      .toThrow(/cannot use --prepare-only/u)
  })

  it('propagates the target and unsigned selectors into runtime preparation subprocesses', () => {
    const target = resolveDesktopPackageTarget('mac-arm64', 'darwin', 'arm64')
    expect(desktopTargetEnvironment({ NULU_DESKTOP_APP_ID: 'com.example.desktop' }, target, true)).toEqual({
      NULU_DESKTOP_APP_ID: 'com.example.desktop',
      NULU_DESKTOP_TARGET_PLATFORM: 'darwin',
      NULU_DESKTOP_TARGET_ARCH: 'arm64',
      NULU_DESKTOP_UNSIGNED: '1',
    })
    expect(desktopTargetEnvironment({ NULU_DESKTOP_UNSIGNED: '1' }, target, false).NULU_DESKTOP_UNSIGNED).toBe('0')
  })

  it('removes ambient certificate inputs for unsigned builds and overrides an inherited signing mode', () => {
    const environment = {
      NULU_DESKTOP_APP_ID: 'com.example.desktop',
      NULU_DESKTOP_WINDOWS_TOKEN_PIN: 'token-secret',
      CSC_LINK: 'private.pfx',
      CSC_KEY_PASSWORD: 'secret',
      WIN_CSC_LINK: 'windows.pfx',
      CSC_IDENTITY_AUTO_DISCOVERY: 'true',
      NULU_DESKTOP_UNSIGNED: '1',
    }
    expect(desktopElectronBuilderEnvironment(environment, true)).toEqual({
      NULU_DESKTOP_APP_ID: 'com.example.desktop',
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      NULU_DESKTOP_UNSIGNED: '1',
    })
    expect(desktopElectronBuilderEnvironment(environment, false)).toEqual({ ...environment, NULU_DESKTOP_UNSIGNED: '0' })
  })

  it.each([false, true])('pins the Windows archive filter for the NSIS decoder (unsigned: %s)', (unsigned) => {
    expect(desktopElectronBuilderEnvironment({
      NULU_DESKTOP_TARGET_PLATFORM: 'win32', ELECTRON_BUILDER_7Z_FILTER: 'ARM64',
    }, unsigned).ELECTRON_BUILDER_7Z_FILTER).toBe('BCJ')
    expect(desktopElectronBuilderEnvironment({
      NULU_DESKTOP_TARGET_PLATFORM: 'darwin', ELECTRON_BUILDER_7Z_FILTER: 'ARM',
    }, unsigned).ELECTRON_BUILDER_7Z_FILTER).toBe('ARM')
  })

  it('keeps Windows signing fields out of build and runtime preparation subprocesses', () => {
    expect(withoutWindowsSigningEnvironment({
      NULU_DESKTOP_WINDOWS_CER_FILE: 'C:\\release\\server.cer',
      NULU_DESKTOP_WINDOWS_TOKEN_PIN: 'token-secret',
      NULU_DESKTOP_WINDOWS_KEY_CONTAINER: 'container',
      NULU_DESKTOP_WINDOWS_SIGNTOOL: 'C:\\tools\\signtool.exe',
      NULU_DESKTOP_AUTO_UPDATE_ENV: 'production',
    })).toEqual({ NULU_DESKTOP_AUTO_UPDATE_ENV: 'production' })
  })

  it('keeps COS credentials out of every packaging subprocess', () => {
    expect(withoutDesktopUploadCredentials({
      DOWNLOAD_TEST_ORIGIN: 'https://desktop-updates.example.com',
      DOWNLOAD_TEST_COS_BUCKET: 'test-download-bucket',
      DOWNLOAD_TEST_COS_SECRET_ID: 'test-id',
      DOWNLOAD_TEST_COS_SECRET_KEY: 'test-key',
      DOWNLOAD_PROD_COS_BUCKET: 'production-download-bucket',
      DOWNLOAD_PROD_COS_SECRET_ID: 'production-id',
      DOWNLOAD_PROD_COS_SECRET_KEY: 'production-key',
      NULU_DESKTOP_AUTO_UPDATE_ENV: 'production',
    })).toEqual({
      DOWNLOAD_TEST_ORIGIN: 'https://desktop-updates.example.com',
      DOWNLOAD_TEST_COS_BUCKET: 'test-download-bucket',
      DOWNLOAD_PROD_COS_BUCKET: 'production-download-bucket',
      NULU_DESKTOP_AUTO_UPDATE_ENV: 'production',
    })
  })
})
