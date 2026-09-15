import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { DESKTOP_HOST_PACKAGE, DESKTOP_HOST_RUNTIME_FILES } from '../src/core-package-set.ts'
import { DESKTOP_RUNTIME_FILE, desktopRuntimeId, readDesktopRuntime, runtimePath, verifyDesktopRuntime } from '../src/runtime-tree.ts'
import { runtimeFixture } from './runtime-fixture.ts'

const roots: string[] = []
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'desktop-runtime-'))
  roots.push(root)
  runtimeFixture(join(root, 'nulu'))
  return root
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

it('verifies a runtime after relocation without depending on build paths', async () => {
  const root = fixture()
  const before = await verifyDesktopRuntime(join(root, 'nulu'), '1.0.0')
  cpSync(join(root, 'nulu'), join(root, 'moved'), { recursive: true })
  expect(desktopRuntimeId(await verifyDesktopRuntime(join(root, 'moved'), '1.0.0'))).toBe(desktopRuntimeId(before))
})
it.each(['changed', 'same-size', 'extra', 'missing'])('checks %s runtime bytes only during build verification', async (operation) => {
  const nulu = join(fixture(), 'nulu')
  const before = readDesktopRuntime(nulu)
  if (operation === 'changed') writeFileSync(join(nulu, 'package.json'), '{}')
  if (operation === 'same-size') writeFileSync(join(nulu, 'package.json'), '{"type":"Module"}\n')
  if (operation === 'extra') writeFileSync(join(nulu, 'extra'), '')
  if (operation === 'missing') rmSync(join(nulu, 'package.json'))
  expect(readDesktopRuntime(nulu)).toEqual(before)
  await expect(verifyDesktopRuntime(nulu, '1.0.0')).rejects.toThrow(/integrity/u)
})
it('rejects filesystem links and incompatible targets', async () => {
  const nulu = join(fixture(), 'nulu')
  await expect(verifyDesktopRuntime(nulu, '1.0.0', { platform: process.platform, arch: 'wrong' })).rejects.toThrow(/incompatible/u)
  symlinkSync(join(nulu, 'node_modules'), join(nulu, 'outside'), process.platform === 'win32' ? 'junction' : 'dir')
  expect(readDesktopRuntime(nulu).release.version).toBe('1.0.0')
  await expect(verifyDesktopRuntime(nulu, '1.0.0')).rejects.toThrow(/unsupported filesystem/u)
})
it('reads file inventory records unchanged during startup', () => {
  const nulu = join(fixture(), 'nulu')
  const path = join(nulu, DESKTOP_RUNTIME_FILE)
  const descriptor = JSON.parse(readFileSync(path, 'utf8')) as { files: unknown[] }
  descriptor.files.unshift({ path: '../outside', bytes: -1.5, sha256: 'unchecked', executable: 'unchecked' })
  writeFileSync(path, JSON.stringify(descriptor))
  expect(readDesktopRuntime(nulu).files).toEqual(descriptor.files)
})
it.each(['missing', 'directory'])('checks a %s Host entry only during build verification', async (operation) => {
  const nulu = join(fixture(), 'nulu')
  const path = join(nulu, 'node_modules', DESKTOP_HOST_PACKAGE, DESKTOP_HOST_RUNTIME_FILES[0])
  rmSync(path)
  if (operation === 'directory') mkdirSync(path)
  expect(readDesktopRuntime(nulu).release.version).toBe('1.0.0')
  await expect(verifyDesktopRuntime(nulu, '1.0.0')).rejects.toThrow(/integrity/u)
})
it('checks the shell version only during build verification', async () => {
  const nulu = join(fixture(), 'nulu')
  expect(readDesktopRuntime(nulu).release.version).toBe('1.0.0')
  await expect(verifyDesktopRuntime(nulu, '2.0.0')).rejects.toThrow(/does not match Electron/u)
})
it.each([
  { schemaVersion: 2 },
  { platform: 'other' },
  { arch: 'other' },
  { release: { schemaVersion: 2 } },
  { release: { hostProtocolVersion: 999 } },
  { release: { nodeVersion: 'invalid' } },
  { release: { pnpmVersion: 'invalid' } },
])('checks release compatibility only during build verification: %j', async (patch) => {
  const nulu = join(fixture(), 'nulu')
  const path = join(nulu, DESKTOP_RUNTIME_FILE)
  const original = readDesktopRuntime(nulu)
  const descriptor = { ...original, ...patch, release: { ...original.release, ...patch.release } }
  writeFileSync(path, JSON.stringify(descriptor))
  expect(readDesktopRuntime(nulu)).toEqual(descriptor)
  await expect(verifyDesktopRuntime(nulu, '1.0.0')).rejects.toThrow(/invalid|incompatible/u)
})
it.each(['missing', 'invalid-json', 'mismatched'])('checks %s shared manifests only during build verification', async (operation) => {
  const nulu = join(fixture(), 'nulu')
  const before = readDesktopRuntime(nulu)
  const path = join(nulu, 'node_modules', DESKTOP_HOST_PACKAGE, 'package.json')
  if (operation === 'missing') rmSync(path)
  else writeFileSync(path, operation === 'invalid-json' ? '{' : '{}')
  expect(readDesktopRuntime(nulu)).toEqual(before)
  await expect(verifyDesktopRuntime(nulu, '1.0.0')).rejects.toThrow()
})
it('rejects a descriptor that maps a shared package outside node_modules', async () => {
  const nulu = join(fixture(), 'nulu')
  const path = join(nulu, DESKTOP_RUNTIME_FILE)
  const descriptor = JSON.parse(readFileSync(path, 'utf8')) as { sharedPackages: { path: string }[] }
  descriptor.sharedPackages[0]!.path = '../outside'
  writeFileSync(path, JSON.stringify(descriptor))
  await expect(verifyDesktopRuntime(nulu, '1.0.0')).rejects.toThrow(/shared package record/u)
})
it('verifies recorded executable permissions only on Unix', async () => {
  const nulu = join(fixture(), 'nulu')
  const path = join(nulu, DESKTOP_RUNTIME_FILE)
  const descriptor = JSON.parse(readFileSync(path, 'utf8')) as { files: { executable: boolean }[] }
  descriptor.files[0]!.executable = !descriptor.files[0]!.executable
  writeFileSync(path, JSON.stringify(descriptor))
  if (process.platform === 'win32') await expect(verifyDesktopRuntime(nulu, '1.0.0')).resolves.toMatchObject(descriptor)
  else await expect(verifyDesktopRuntime(nulu, '1.0.0')).rejects.toThrow(/integrity/u)
})
it.each(['../outside', '/absolute', 'C:/absolute', 'a\\b', 'a//b', './a'])('rejects nonportable path %s', (path) => {
  expect(() => runtimePath('/runtime', path)).toThrow(/invalid relative path/u)
})
