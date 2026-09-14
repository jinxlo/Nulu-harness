import { describe, expect, it } from 'vitest'
import type { NpmPackageLock, RegistryIndex } from './benchmark-npm-resolution.ts'
import {
  assertDualDshInstallLayout,
  buildDualDshRegistry,
} from './verify-npm-install-layout.ts'

function validLayout(): NpmPackageLock {
  return {
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { '@worldapptechnologies/nulu': '0.2.0', 'nulu-previous': 'npm:@worldapptechnologies/nulu@0.1.0' } },
      'node_modules/@worldapptechnologies/cordis': { version: '4.0.1' },
      'node_modules/@worldapptechnologies/nulu': {
        version: '0.2.0',
        dependencies: { '@worldapptechnologies/nulu-child': '^0.2.0' },
        peerDependencies: { '@worldapptechnologies/cordis': '^4.0.1' },
      },
      'node_modules/@worldapptechnologies/nulu-child': {
        version: '0.2.0',
        dependencies: { '@worldapptechnologies/nulu-leaf': '^0.2.0' },
      },
      'node_modules/@worldapptechnologies/nulu-leaf': { version: '0.2.0' },
      'node_modules/nulu-previous': {
        name: '@worldapptechnologies/nulu',
        version: '0.1.0',
        dependencies: { '@worldapptechnologies/nulu-child': '^0.1.0' },
        peerDependencies: { '@worldapptechnologies/cordis': '^4.0.1' },
      },
      'node_modules/nulu-previous/node_modules/@worldapptechnologies/nulu-child': {
        version: '0.1.0',
        dependencies: { '@worldapptechnologies/nulu-leaf': '^0.1.0' },
      },
      'node_modules/nulu-previous/node_modules/@worldapptechnologies/nulu-leaf': { version: '0.1.0' },
    },
  }
}

describe('npm install layout verifier', () => {
  it('creates two incompatible versions of every NULU package', () => {
    const index: RegistryIndex = new Map([
      ['@worldapptechnologies/nulu', new Map([['0.1.1-rc.2', {
        name: '@worldapptechnologies/nulu',
        version: '0.1.1-rc.2',
        dependencies: { '@worldapptechnologies/nulu-child': '^0.1.1-rc.2' },
        peerDependencies: { '@worldapptechnologies/cordis': '^4.0.1' },
      }]])],
      ['@worldapptechnologies/nulu-child', new Map([['0.1.1-rc.2', {
        name: '@worldapptechnologies/nulu-child',
        version: '0.1.1-rc.2',
      }]])],
      ['@worldapptechnologies/cordis', new Map([['4.0.1', {
        name: '@worldapptechnologies/cordis',
        version: '4.0.1',
      }]])],
    ])

    const dual = buildDualDshRegistry(index, '0.1.1-rc.2')

    expect([...dual.get('@worldapptechnologies/nulu')?.keys() ?? []]).toEqual(['0.1.0', '0.2.0'])
    expect(dual.get('@worldapptechnologies/nulu')?.get('0.1.0')).toMatchObject({
      version: '0.1.0',
      dependencies: { '@worldapptechnologies/nulu-child': '^0.1.0' },
      peerDependencies: { '@worldapptechnologies/cordis': '^4.0.1' },
    })
    expect(dual.get('@worldapptechnologies/nulu')?.get('0.2.0')).toMatchObject({
      version: '0.2.0',
      dependencies: { '@worldapptechnologies/nulu-child': '^0.2.0' },
    })
    expect(dual.get('@worldapptechnologies/cordis')).toBe(index.get('@worldapptechnologies/cordis'))
  })

  it('accepts isolated NULU releases with one shared Cordis installation', () => {
    expect(assertDualDshInstallLayout(validLayout())).toEqual({
      nuluPackagesPerVersion: 3,
      checkedDshEdges: 4,
    })
  })

  it.each([
    ['react', 'node_modules/react'],
    ['react-dom', 'node_modules/react-dom'],
    ['react', 'node_modules/nulu-previous/node_modules/react'],
    ['react-dom', 'node_modules/nulu-previous/node_modules/react-dom'],
  ])('rejects browser runtime %s installed at %s in the NULU-only consumer', (name, path) => {
    const layout = validLayout()
    const packages = { ...layout.packages, [path]: { version: '18.3.1' } }
    expect(() => assertDualDshInstallLayout({ ...layout, packages })).toThrow(
      `${path}: ${name} is a browser build input`,
    )
  })

  it('rejects an internal edge that crosses release versions', () => {
    const layout = validLayout()
    const packages = { ...layout.packages }
    Reflect.deleteProperty(packages, 'node_modules/nulu-previous/node_modules/@worldapptechnologies/nulu-leaf')

    expect(() => assertDualDshInstallLayout({ ...layout, packages })).toThrow(
      'node_modules/nulu-previous/node_modules/@worldapptechnologies/nulu-child: dependencies '
      + '@worldapptechnologies/nulu-leaf resolves to node_modules/@worldapptechnologies/nulu-leaf@0.2.0, expected 0.1.0',
    )
  })

  it('rejects a second Cordis installation', () => {
    const layout = validLayout()
    const packages = {
      ...layout.packages,
      'node_modules/nulu-previous/node_modules/@worldapptechnologies/cordis': { version: '4.0.1' },
    }

    expect(() => assertDualDshInstallLayout({ ...layout, packages })).toThrow(
      'expected one shared @worldapptechnologies/cordis',
    )
  })
})
