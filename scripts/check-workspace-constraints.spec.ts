/** Experimental-package publication and dependency constraints. */

import { describe, expect, it } from 'vitest'
import {
  isPublicExperimentalPackageDirectory,
  PRIVATE_EXPERIMENTAL_PACKAGE_DIRECTORIES,
} from './experimental-package-policy.ts'
import {
  checkDshFamilyVersion,
  checkExperimentalDependencyIsolation,
  checkExperimentalManifest,
  expectedNuluPackageFiles,
  type WorkspaceManifest,
} from './check-workspace-constraints.ts'

const experimental = {
  dir: 'packages/experimental/prototype',
  manifest: {
    name: '@worldapptechnologies/nulu-experimental-prototype',
    publishConfig: { access: 'public' },
  },
} satisfies WorkspaceManifest

describe('experimental workspace constraints', () => {
  it('requires the experimental package-name prefix', () => {
    expect(checkExperimentalManifest({
      ...experimental,
      manifest: { ...experimental.manifest, name: '@worldapptechnologies/nulu-prototype' },
    })).toEqual([
      '@worldapptechnologies/nulu-prototype: experimental package name must start with "@worldapptechnologies/nulu-experimental-"',
    ])
  })

  it('requires public metadata for unlisted experimental packages', () => {
    expect(checkExperimentalManifest(experimental)).toEqual([])
    expect(checkExperimentalManifest({
      ...experimental,
      manifest: { name: experimental.manifest.name, private: true },
    })).toEqual([
      '@worldapptechnologies/nulu-experimental-prototype: public experimental package must not set "private": true',
      '@worldapptechnologies/nulu-experimental-prototype: public experimental package must set publishConfig.access to "public"',
    ])
  })

  it('requires private metadata for an explicitly excluded prototype', () => {
    const { dir, manifest: { name } } = experimental
    const privateDirectories = [dir]
    expect(isPublicExperimentalPackageDirectory(dir, privateDirectories)).toBe(false)
    expect(checkExperimentalManifest({ dir, manifest: { name, private: true } }, privateDirectories)).toEqual([])
    expect(checkExperimentalManifest(experimental, privateDirectories)).toEqual([
      `${name}: experimental package must set "private": true`,
      `${name}: experimental package must omit publishConfig`,
    ])
  })

  it('keeps the current experimental publication set unrestricted', () => {
    expect(PRIVATE_EXPERIMENTAL_PACKAGE_DIRECTORIES).toEqual([])
  })

  it('limits the public default to experimental package directories', () => {
    expect(isPublicExperimentalPackageDirectory(experimental.dir)).toBe(true)
    for (const dir of [
      'packages/core/session',
      'apps/cli',
      'vendor/cordis',
      'packages/experimental',
      'packages/experimental/prototype/src',
      ...PRIVATE_EXPERIMENTAL_PACKAGE_DIRECTORIES,
    ]) {
      expect(isPublicExperimentalPackageDirectory(dir)).toBe(false)
    }
  })

  it.each(['dependencies', 'optionalDependencies', 'peerDependencies'] as const)(
    'rejects release %s on an experimental package',
    (section) => {
      expect(checkExperimentalDependencyIsolation([experimental, {
        dir: 'packages/core/consumer',
        manifest: {
          name: '@worldapptechnologies/nulu-consumer',
          [section]: { '@worldapptechnologies/nulu-experimental-prototype': 'workspace:^' },
        },
      }])).toEqual([
        `@worldapptechnologies/nulu-consumer: ${section}.@worldapptechnologies/nulu-experimental-prototype must not reference an experimental package`,
      ])
    },
  )

  it('allows development and experimental consumers but rejects the Python release runtime', () => {
    const manifests: WorkspaceManifest[] = [experimental, {
      dir: 'packages/core/test-only',
      manifest: {
        name: '@worldapptechnologies/nulu-test-only',
        devDependencies: { '@worldapptechnologies/nulu-experimental-prototype': 'workspace:^' },
      },
    }, {
      dir: 'packages/experimental/consumer',
      manifest: {
        name: '@worldapptechnologies/nulu-experimental-consumer',
        dependencies: { '@worldapptechnologies/nulu-experimental-prototype': 'workspace:^' },
      },
    }, {
      dir: 'python/sdk-runtime',
      manifest: {
        name: '@worldapptechnologies/nulu-python-runtime',
        dependencies: { '@worldapptechnologies/nulu-experimental-prototype': 'workspace:^' },
      },
    }]

    expect(checkExperimentalDependencyIsolation(manifests)).toEqual([
      '@worldapptechnologies/nulu-python-runtime: dependencies.@worldapptechnologies/nulu-experimental-prototype must not reference an experimental package',
    ])
  })
})

describe('nulu family version coherence', () => {
  it('rejects a package carrying a stale shared version', () => {
    expect(checkNuluFamilyVersion(
      { name: '@worldapptechnologies/nulu-http-proxy', version: '0.1.2-alpha.5' },
      '0.1.2-rc.1',
    )).toBe('@worldapptechnologies/nulu-http-proxy: package.json version must match root version 0.1.2-rc.1')
  })

  it('rejects the root-named CLI app on a stale shared version', () => {
    expect(checkNuluFamilyVersion(
      { name: '@worldapptechnologies/nulu', version: '0.1.2-alpha.5' },
      '0.1.2-rc.1',
    )).toBe('@worldapptechnologies/nulu: package.json version must match root version 0.1.2-rc.1')
  })

  it('accepts a manifest carrying the shared version', () => {
    expect(checkNuluFamilyVersion(
      { name: '@worldapptechnologies/nulu-http-proxy', version: '0.1.2-rc.1' },
      '0.1.2-rc.1',
    )).toBeUndefined()
  })

  it('leaves other sequences to their own version lines', () => {
    expect(checkNuluFamilyVersion({ name: '@worldapptechnologies/cordis', version: '4.0.1' }, '0.1.2-rc.1')).toBeUndefined()
    expect(checkNuluFamilyVersion(
      { name: '@worldapptechnologies/node-addon-system', version: '0.1.1' },
      '0.1.2-rc.1',
    )).toBeUndefined()
    expect(checkNuluFamilyVersion({ version: '0.1.2-alpha.5' }, '0.1.2-rc.1')).toBeUndefined()
  })
})

describe('package payload constraints', () => {
  it('includes a declared profile patch without a package-name allowlist', () => {
    expect(expectedNuluPackageFiles({
      name: '@worldapptechnologies/nulu-private-profile',
      nulu: { bundle: { patch: './cordis.patch.yml' } },
    })).toEqual([
      'lib/index.js',
      'cordis.patch.yml',
      'lib/types/**/*.d.ts',
    ])
  })
})
