import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_NULU_HOME_DISPLAY,
  NULU_HOME_DIR_NAME,
  canonicalizeWatchPath,
  defaultDshHome,
  nuluCachePath,
  nuluHomeDisplay,
  nuluHomePath,
  expandHomePath,
  resolveDshHome,
} from '@worldapptechnologies/nulu-home-paths'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('nulu path helpers', () => {
  it('owns the shared default NULU home directory name', () => {
    expect(NULU_HOME_DIR_NAME).toBe('.nulu')
    expect(DEFAULT_NULU_HOME_DISPLAY).toBe('~/.nulu')
    expect(defaultDshHome()).toBe(join(homedir(), '.nulu'))
  })

  it('expands tilde paths without changing non-tilde paths', () => {
    expect(expandHomePath('~')).toBe(homedir())
    expect(expandHomePath('~/.nulu')).toBe(join(homedir(), '.nulu'))
    expect(expandHomePath('~\\.nulu')).toBe(join(homedir(), '.nulu'))
    expect(expandHomePath('/tmp/.nulu')).toBe('/tmp/.nulu')
    expect(expandHomePath('~other/.nulu')).toBe('~other/.nulu')
  })

  it('resolves explicit path before NULU_HOME and the default', () => {
    const envHome = join(homedir(), 'env-nulu')

    expect(resolveDshHome('/tmp/explicit-nulu', { NULU_HOME: '~/env-nulu' })).toBe(resolve('/tmp/explicit-nulu'))
    expect(resolveDshHome(undefined, { NULU_HOME: '~/env-nulu' })).toBe(envHome)
    expect(resolveDshHome(undefined, {})).toBe(defaultDshHome())
  })

  it('treats an empty or whitespace-only NULU_HOME as unset', () => {
    expect(resolveDshHome(undefined, { NULU_HOME: '' })).toBe(defaultDshHome())
    expect(resolveDshHome(undefined, { NULU_HOME: '   ' })).toBe(defaultDshHome())
  })

  it('joins child segments onto the resolved NULU_HOME', () => {
    vi.stubEnv('NULU_HOME', '~/env-nulu')
    expect(nuluHomePath()).toBe(join(homedir(), 'env-nulu'))
    expect(nuluHomePath('storages', 'cache')).toBe(join(homedir(), 'env-nulu', 'storages', 'cache'))
  })

  it('labels a resolved home by whether it is the default root', () => {
    expect(nuluHomeDisplay(resolve(defaultDshHome()))).toBe('~/.nulu')
    expect(nuluHomeDisplay('/some/other/root')).toBe('$NULU_HOME')
  })

  it.each([
    [undefined, join(homedir(), '.nulu')],
    ['', join(homedir(), '.nulu')],
    ['   ', join(homedir(), '.nulu')],
    ['~/env-nulu', join(homedir(), 'env-nulu')],
    ['./relative-nulu', resolve('./relative-nulu')],
  ] as const)('resolves cache paths with NULU_HOME=%j', (home, expectedHome) => {
    vi.stubEnv('NULU_HOME', home)
    try {
      expect(nuluCachePath()).toBe(join(expectedHome, 'cache'))
      expect(nuluCachePath('models', 'index.json')).toBe(join(expectedHome, 'cache', 'models', 'index.json'))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('resolves configured cache homes before the environment', () => {
    vi.stubEnv('NULU_HOME', '~/env-nulu')
    try {
      expect(nuluCachePath({ nuluHome: '~/explicit-nulu' })).toBe(join(homedir(), 'explicit-nulu', 'cache'))
      expect(nuluCachePath({ nuluHome: './explicit-nulu' }, 'attachments', 'request-images'))
        .toBe(resolve('./explicit-nulu/cache/attachments/request-images'))
      expect(nuluCachePath({}, 'attachments')).toBe(join(homedir(), 'env-nulu', 'cache', 'attachments'))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('canonicalizes a watcher ancestor while preserving a missing suffix', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nulu-watch-path-'))
    const target = join(root, 'target')
    const alias = join(root, 'alias')
    try {
      await mkdir(target)
      await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir')
      await expect(canonicalizeWatchPath(alias)).resolves.toBe(await realpath(target))
      await expect(canonicalizeWatchPath(join(alias, 'later', 'config.yml'))).resolves.toBe(
        join(await realpath(target), 'later', 'config.yml'),
      )
      const file = join(root, 'file')
      await writeFile(file, 'not a directory')
      await expect(canonicalizeWatchPath(join(file, 'child'))).rejects.toMatchObject({ code: 'ENOTDIR' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
