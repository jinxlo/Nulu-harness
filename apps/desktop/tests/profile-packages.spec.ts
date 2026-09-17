import { execFileSync } from 'node:child_process'
import { lstatSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { createPluginProfile } from '../src/project-manager.ts'
import {
  linkDesktopHostPackages,
  readDesktopProfileState,
  recordDesktopRuntimeProfile,
  unlinkDesktopHostPackages,
  validateDesktopPluginGraph,
} from '../src/profile-packages.ts'
import { runtimeFixture, writePackage } from './runtime-fixture.ts'

const roots: string[] = []
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'desktop-profile-'))
  roots.push(root)
  const nulu = join(root, 'nulu')
  const runtime = runtimeFixture(nulu)
  const profile = join(root, 'profile')
  createPluginProfile(profile)
  linkDesktopHostPackages(profile, nulu, runtime)
  return { root, nulu, runtime, profile }
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

it('loads one shared ESM instance from both host and external plugin while keeping ordinary dependencies private', () => {
  const { nulu, runtime, profile } = fixture()
  writePackage(join(nulu, 'node_modules'), 'ordinary', {}, 'export default "host"')
  writePackage(join(profile, 'node_modules'), 'ordinary', {}, 'export default "plugin"')
  const plugin = writePackage(join(profile, 'node_modules'), 'plugin', {
    peerDependencies: { '@worldapptechnologies/cordis': '^1.0.0' }, dependencies: { ordinary: '1.0.0' },
  }, 'export { identity } from "@worldapptechnologies/cordis"; export { default as ordinary } from "ordinary"')
  validateDesktopPluginGraph(profile, nulu, runtime, ['plugin'])
  const entry = join(nulu, 'check.mjs')
  writeFileSync(entry, `import {identity} from '@worldapptechnologies/cordis'; import ordinary from 'ordinary'; import * as plugin from ${JSON.stringify(pathToFileURL(join(plugin, 'index.js')).href)}; console.log(JSON.stringify({same:identity===plugin.identity, host:ordinary, plugin:plugin.ordinary}))`)
  const output = execFileSync(process.execPath, [entry], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' } })
  expect(JSON.parse(output)).toEqual({ same: true, host: 'host', plugin: 'plugin' })
})
it('runtime resolution retains and ignores an existing Link generation', () => {
  const { nulu, runtime, profile } = fixture()
  const links = readDesktopProfileState(profile)?.links
  expect(links?.length).toBeGreaterThan(0)

  recordDesktopRuntimeProfile(profile, runtime)
  expect(readDesktopProfileState(profile)?.links).toEqual(links)
  expect(lstatSync(join(profile, 'node_modules/@worldapptechnologies/cordis')).isSymbolicLink()).toBe(true)
  expect(() => { validateDesktopPluginGraph(profile, nulu, runtime, [], 'runtime') }).not.toThrow()
})
it.each(['nested', 'alias'])('rejects a %s second copy of a host package', (placement) => {
  const { nulu, runtime, profile } = fixture()
  const plugin = writePackage(join(profile, 'node_modules'), 'plugin')
  if (placement === 'nested') writePackage(join(plugin, 'node_modules'), '@worldapptechnologies/cordis')
  else writePackage(join(profile, 'node_modules'), 'alias', { name: '@worldapptechnologies/cordis' })
  expect(() =>{  validateDesktopPluginGraph(profile, nulu, runtime, ['plugin']) }).toThrow(/duplicate or aliased/u)
})
it('rejects a host package declared as an ordinary dependency', () => {
  const { nulu, runtime, profile } = fixture()
  writePackage(join(profile, 'node_modules'), 'plugin', { dependencies: { '@worldapptechnologies/cordis': '^1.0.0' } })
  expect(() =>{  validateDesktopPluginGraph(profile, nulu, runtime, ['plugin']) }).toThrow(/peer dependency/u)
})
it('rejects incompatible peers only when the plugin is enabled', () => {
  const { nulu, runtime, profile } = fixture()
  writePackage(join(profile, 'node_modules'), 'plugin', { peerDependencies: { '@worldapptechnologies/cordis': '^2.0.0' } })
  expect(() =>{  validateDesktopPluginGraph(profile, nulu, runtime, ['plugin']) }).toThrow(/found 1.0.0/u)
  expect(() =>{  validateDesktopPluginGraph(profile, nulu, runtime, []) }).not.toThrow()
})
it('refuses to satisfy a plugin dependency from an ancestor CLI project', () => {
  const { root, nulu, runtime, profile } = fixture()
  writePackage(join(root, 'node_modules'), 'ambient')
  writePackage(join(profile, 'node_modules'), 'plugin', { dependencies: { ambient: '1.0.0' } })
  expect(() =>{  validateDesktopPluginGraph(profile, nulu, runtime, ['plugin']) }).toThrow(/outside its owned packages/u)
})
it('removes broken owned links without following them', () => {
  const { root, profile } = fixture()
  writePackage(join(profile, 'node_modules'), 'plugin')
  rmSync(join(root, 'nulu'), { recursive: true })
  expect(() =>{  unlinkDesktopHostPackages(profile) }).not.toThrow()
})
it('refuses to replace an unowned package at a managed name', () => {
  const { profile } = fixture()
  unlinkSync(join(profile, 'node_modules/@worldapptechnologies/cordis'))
  writePackage(join(profile, 'node_modules'), '@worldapptechnologies/cordis')
  expect(() =>{  unlinkDesktopHostPackages(profile) }).toThrow(/unowned package/u)
})
it('rejects private package links instead of following cycles or old transaction paths', () => {
  const { nulu, runtime, profile } = fixture()
  const plugin = writePackage(join(profile, 'node_modules'), 'plugin')
  symlinkSync(plugin, join(profile, 'node_modules/alias'), process.platform === 'win32' ? 'junction' : 'dir')
  expect(() =>{  validateDesktopPluginGraph(profile, nulu, runtime, ['plugin']) }).toThrow(/linked private package/u)
})
