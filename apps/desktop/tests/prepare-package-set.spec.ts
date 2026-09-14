import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertDesktopHostPackageFiles,
  selectDesktopPackageClosure,
  type PackedDesktopPackage,
} from '../scripts/prepare-package-set.ts'

function packed(name: string, manifest: Record<string, unknown> = {}): PackedDesktopPackage {
  return { tarball: `${name}.tgz`, manifest: { name, version: '1.0.0', ...manifest } }
}

describe('desktop package-set selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not select a packaging target when imported as a library', async () => {
    vi.stubEnv('NULU_DESKTOP_TARGET_PLATFORM', 'linux')
    vi.stubEnv('NULU_DESKTOP_TARGET_ARCH', 'x64')
    vi.resetModules()
    await expect(import('../scripts/prepare-package-set.ts')).resolves.toHaveProperty('prepareDesktopPackageSet')
  })

  it('includes only the available internal production closure', () => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@worldapptechnologies/nulu', packed('@worldapptechnologies/nulu', {
        dependencies: { '@worldapptechnologies/nulu-base': '^1.0.0', external: '^2.0.0' },
        optionalDependencies: { '@worldapptechnologies/platform-package': '1.0.0', '@worldapptechnologies/missing-platform': '1.0.0' },
      })],
      ['@worldapptechnologies/nulu-desktop-host', packed('@worldapptechnologies/nulu-desktop-host', {
        dependencies: { '@worldapptechnologies/nulu': '^1.0.0' },
      })],
      ['@worldapptechnologies/nulu-base', packed('@worldapptechnologies/nulu-base', {
        peerDependencies: { '@worldapptechnologies/cordis': '^1.0.0' },
      })],
      ['@worldapptechnologies/cordis', packed('@worldapptechnologies/cordis')],
      ['@worldapptechnologies/platform-package', packed('@worldapptechnologies/platform-package')],
      ['@worldapptechnologies/unused', packed('@worldapptechnologies/unused')],
    ])
    expect(selectDesktopPackageClosure(available).map(entry => entry.manifest.name)).toEqual([
      '@worldapptechnologies/cordis',
      '@worldapptechnologies/nulu',
      '@worldapptechnologies/nulu-base',
      '@worldapptechnologies/nulu-desktop-host',
      '@worldapptechnologies/platform-package',
    ])
  })

  it('rejects a required internal package absent from the packed release inputs', () => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@worldapptechnologies/nulu', packed('@worldapptechnologies/nulu', {
        dependencies: { '@worldapptechnologies/nulu-base': '^1.0.0' },
      })],
      ['@worldapptechnologies/nulu-desktop-host', packed('@worldapptechnologies/nulu-desktop-host', {
        dependencies: { '@worldapptechnologies/nulu': '^1.0.0' },
      })],
    ])
    expect(() => selectDesktopPackageClosure(available)).toThrow(/unpacked internal package/u)
    expect(() => selectDesktopPackageClosure(new Map([
      ['@worldapptechnologies/nulu', packed('@worldapptechnologies/nulu')],
    ]))).toThrow(/omit @worldapptechnologies\/nulu-desktop-host/u)
  })

  it('requires the Desktop Host entry and its packaged overlay', () => {
    const files = [
      'package/lib/index.js',
      'package/config/desktop.cordis.patch.yml',
    ]
    expect(() => {
      assertDesktopHostPackageFiles(files)
    }).not.toThrow()
    expect(() => {
      assertDesktopHostPackageFiles(files.slice(0, 1))
    }).toThrow(/desktop\.cordis\.patch\.yml/u)
    expect(() => {
      assertDesktopHostPackageFiles(files.slice(1))
    }).toThrow(/lib\/index\.js/u)
  })
})
