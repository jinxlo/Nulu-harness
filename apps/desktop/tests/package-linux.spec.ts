/** Pin the Linux release configuration that AppImage tooling depends on. */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DesktopElectronBuilderConfig } from '../electron-builder.config.mjs'

let config: DesktopElectronBuilderConfig

beforeAll(async () => {
  vi.stubEnv('NULU_DESKTOP_APP_ID', 'com.worldapptechnologies.nulu-harness')
  vi.stubEnv('NULU_DESKTOP_AUTO_UPDATE_ENV', 'test')
  vi.stubEnv('DOWNLOAD_TEST_ORIGIN', 'https://download.worldapptechnologies.com')
  vi.stubEnv('NULU_DESKTOP_TARGET_PLATFORM', 'linux')
  vi.stubEnv('NULU_DESKTOP_TARGET_ARCH', 'x64')
  const module = await import('../electron-builder.config.mjs')
  config = module.createElectronBuilderConfig(process.env, 'linux', 'x64')
})

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('desktop Linux release configuration', () => {
  it('keeps the AppImage executable name inside the filesystem-safe character set', () => {
    // electron-builder rejects the scoped package name `@worldapptechnologies/nulu-desktop`.
    expect(config.linux.executableName).toBe('nulu-harness')
    expect(config.linux.executableName).toMatch(/^[A-Za-z0-9._-]+$/u)
  })

  it('packages the AppImage for Linux', () => {
    expect(config.linux.target).toEqual(['AppImage'])
  })
})
