import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import yaml from 'js-yaml'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertClientBuildEnvironment,
  clientBuildEnvironmentDefines,
  clientBuildProcessEnvironment,
  officialClientBuildEnvironment,
  readClientBuildRecord,
  repositoryClientBuildEnvironment,
  repositoryCommitHash,
  repositoryGitDirty,
  repositoryVersion,
  resolveClientBuildEnvironment,
  writeClientBuildRecord,
} from './client-build-environment.ts'
import { clientBundle } from '../packages/client/tsdown.client.ts'

const root = resolve(import.meta.dirname, '..')
const PROBE_NAME = 'NULU_CLIENT_BUILD_TEST'
const COMMIT_HASH = '0123456789abcdef0123456789abcdef01234567'
const PROBE_KEY = `process.env.${PROBE_NAME}`
const originalProbe = process.env[PROBE_NAME]
const roots: string[] = []
const nuluBuildWorkflows = [
  'build-exe-for-python-sdk.yml',
  'ci.yml',
  'e2b-e2e.yml',
  'e2e.yml',
  'release.yml',
  'release-publish.yml',
  'sandbox.yml',
]

afterEach(() => {
  if (originalProbe === undefined) Reflect.deleteProperty(process.env, PROBE_NAME)
  else process.env[PROBE_NAME] = originalProbe
  vi.resetModules()
  for (const fixtureRoot of roots.splice(0)) rmSync(fixtureRoot, { recursive: true, force: true })
})

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function buildFixture(environment: Record<string, string>): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'nulu-client-build-'))
  roots.push(fixtureRoot)
  write(join(fixtureRoot, 'apps/web/dist/index.html'), '<main></main>')
  write(join(fixtureRoot, 'packages/client/example/lib/client.js'), 'module.exports = {}\n')
  writeClientBuildRecord(fixtureRoot, environment)
  return fixtureRoot
}

function git(root: string, args: readonly string[]): string {
  return execFileSync('git', [...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function repositoryFixture(version = '1.2.3-rc.4'): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'nulu-client-build-repository-'))
  roots.push(fixtureRoot)
  write(join(fixtureRoot, 'package.json'), `${JSON.stringify({ version })}\n`)
  write(join(fixtureRoot, 'tracked.txt'), 'committed\n')
  git(fixtureRoot, ['init'])
  git(fixtureRoot, ['config', 'user.name', 'NULU test'])
  git(fixtureRoot, ['config', 'user.email', 'nulu-test@example.invalid'])
  git(fixtureRoot, ['config', 'commit.gpgsign', 'false'])
  git(fixtureRoot, ['add', 'package.json', 'tracked.txt'])
  git(fixtureRoot, ['commit', '-m', 'fixture'])
  return fixtureRoot
}

describe('client build environment', () => {
  it('requires an exact public environment for a named artifact profile', () => {
    const expected = {
      NULU_CLIENT_BUILD_PROFILE: 'official',
      NULU_CLIENT_COMMIT_HASH: COMMIT_HASH.slice(0, 7),
      NULU_CLIENT_TITLE: 'Nulu Harness',
      NULU_CLIENT_VERSION: '1.2.3',
    } as const

    expect(() => { assertClientBuildEnvironment({ PATH: '/bin', ...expected }, expected) }).not.toThrow()
    expect(() => { assertClientBuildEnvironment({}, expected) }).toThrow(/NULU_CLIENT_TITLE/)
    expect(() => { assertClientBuildEnvironment({ NULU_CLIENT_TITLE: 'Other' }, expected) }).toThrow(/NULU_CLIENT_TITLE/)
    expect(() => {
      assertClientBuildEnvironment({ ...expected, NULU_CLIENT_UNDECLARED: 'value' }, expected)
    }).toThrow(/NULU_CLIENT_UNDECLARED/)
  })

  it('inherits public values by default and isolates an explicit official profile', () => {
    const parent = {
      PATH: '/bin',
      NULU_BUILD_CLIENT_PROFILE: 'official',
      NULU_CLIENT_BUILD_PROFILE: 'local',
      NULU_CLIENT_COMMIT_HASH: COMMIT_HASH.slice(0, 7),
      NULU_CLIENT_GIT_DIRTY: 'true',
      NULU_CLIENT_TITLE: 'Local title',
      NULU_CLIENT_VERSION: '1.2.3',
      NULU_CLIENT_EXTRA: 'local-extra',
    }

    expect(resolveClientBuildEnvironment({ NULU_CLIENT_TITLE: 'Local title' })).toEqual({
      NULU_CLIENT_TITLE: 'Local title',
    })
    expect(resolveClientBuildEnvironment(parent)).toEqual({
      NULU_CLIENT_BUILD_PROFILE: 'official',
      NULU_CLIENT_COMMIT_HASH: COMMIT_HASH.slice(0, 7),
      NULU_CLIENT_TITLE: 'Nulu Harness',
      NULU_CLIENT_VERSION: '1.2.3',
    })
    expect(() => {
      resolveClientBuildEnvironment({ NULU_BUILD_CLIENT_PROFILE: 'official' })
    }).toThrow(/NULU_CLIENT_COMMIT_HASH/)
    expect(() => {
      resolveClientBuildEnvironment({
        NULU_BUILD_CLIENT_PROFILE: 'official',
        NULU_CLIENT_COMMIT_HASH: COMMIT_HASH.slice(0, 7),
      })
    }).toThrow(/NULU_CLIENT_VERSION/)
    expect(() => { resolveClientBuildEnvironment({}, 'unknown') }).toThrow(/unknown client build profile/)
    expect(clientBuildProcessEnvironment(parent, {
      NULU_CLIENT_BUILD_PROFILE: 'official',
      NULU_CLIENT_COMMIT_HASH: COMMIT_HASH.slice(0, 7),
      NULU_CLIENT_TITLE: 'Nulu Harness',
      NULU_CLIENT_VERSION: '1.2.3',
    })).toEqual({
      PATH: '/bin',
      NULU_CLIENT_BUILD_PROFILE: 'official',
      NULU_CLIENT_COMMIT_HASH: COMMIT_HASH.slice(0, 7),
      NULU_CLIENT_TITLE: 'Nulu Harness',
      NULU_CLIENT_VERSION: '1.2.3',
    })
    expect(repositoryCommitHash('/unused', { NULU_CLIENT_COMMIT_HASH: COMMIT_HASH })).toBe(COMMIT_HASH.slice(0, 7))
  })

  it('owns repository version, commit, and dirty metadata for complete builds', () => {
    const fixtureRoot = repositoryFixture()
    const commit = git(fixtureRoot, ['rev-parse', '--short=7', 'HEAD'])

    expect(repositoryVersion(fixtureRoot)).toBe('1.2.3-rc.4')
    expect(repositoryGitDirty(fixtureRoot)).toBe(false)
    expect(repositoryClientBuildEnvironment(fixtureRoot, {
      NULU_CLIENT_COMMIT_HASH: COMMIT_HASH,
      NULU_CLIENT_EXTRA: 'preserved',
      NULU_CLIENT_GIT_DIRTY: 'true',
      NULU_CLIENT_VERSION: 'spoofed',
    })).toEqual({
      NULU_CLIENT_COMMIT_HASH: COMMIT_HASH.slice(0, 7),
      NULU_CLIENT_EXTRA: 'preserved',
      NULU_CLIENT_VERSION: '1.2.3-rc.4',
    })
    expect(officialClientBuildEnvironment(fixtureRoot)).toEqual({
      NULU_CLIENT_BUILD_PROFILE: 'official',
      NULU_CLIENT_COMMIT_HASH: commit,
      NULU_CLIENT_TITLE: 'Nulu Harness',
      NULU_CLIENT_VERSION: '1.2.3-rc.4',
    })

    write(join(fixtureRoot, '.gitignore'), 'ignored.txt\n')
    git(fixtureRoot, ['add', '.gitignore'])
    git(fixtureRoot, ['commit', '-m', 'ignore fixture'])
    write(join(fixtureRoot, 'ignored.txt'), 'ignored\n')
    expect(repositoryGitDirty(fixtureRoot)).toBe(false)
    rmSync(join(fixtureRoot, 'ignored.txt'))

    write(join(fixtureRoot, 'tracked.txt'), 'unstaged\n')
    expect(repositoryGitDirty(fixtureRoot)).toBe(true)
    write(join(fixtureRoot, 'tracked.txt'), 'committed\n')
    expect(repositoryGitDirty(fixtureRoot)).toBe(false)

    write(join(fixtureRoot, 'tracked.txt'), 'staged\n')
    git(fixtureRoot, ['add', 'tracked.txt'])
    expect(repositoryGitDirty(fixtureRoot)).toBe(true)
    git(fixtureRoot, ['commit', '-m', 'staged fixture'])
    expect(repositoryGitDirty(fixtureRoot)).toBe(false)

    write(join(fixtureRoot, 'untracked.txt'), 'untracked\n')
    expect(repositoryGitDirty(fixtureRoot)).toBe(true)
    expect(repositoryClientBuildEnvironment(fixtureRoot, {
      NULU_CLIENT_COMMIT_HASH: COMMIT_HASH,
    })).toEqual({
      NULU_CLIENT_COMMIT_HASH: COMMIT_HASH.slice(0, 7),
      NULU_CLIENT_GIT_DIRTY: 'true',
      NULU_CLIENT_VERSION: '1.2.3-rc.4',
    })

    rmSync(join(fixtureRoot, 'untracked.txt'))
    const submoduleSource = repositoryFixture('9.8.7')
    git(fixtureRoot, ['-c', 'protocol.file.allow=always', 'submodule', 'add', submoduleSource, 'submodule'])
    git(fixtureRoot, ['commit', '-am', 'submodule fixture'])
    expect(repositoryGitDirty(fixtureRoot)).toBe(false)
    write(join(fixtureRoot, 'submodule/tracked.txt'), 'modified submodule\n')
    expect(repositoryGitDirty(fixtureRoot)).toBe(true)
  })

  it('omits dirty metadata when repository metadata is unavailable', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'nulu-client-build-no-git-'))
    roots.push(fixtureRoot)
    write(join(fixtureRoot, 'package.json'), '{"version":"2.0.0"}\n')

    expect(repositoryGitDirty(fixtureRoot)).toBeUndefined()
    expect(repositoryClientBuildEnvironment(fixtureRoot, {
      NULU_CLIENT_COMMIT_HASH: COMMIT_HASH,
      NULU_CLIENT_GIT_DIRTY: 'true',
    })).toEqual({
      NULU_CLIENT_COMMIT_HASH: COMMIT_HASH.slice(0, 7),
      NULU_CLIENT_VERSION: '2.0.0',
    })
  })

  it('defines only public client values over a non-enumerable fallback', () => {
    expect(clientBuildEnvironmentDefines({
      PATH: '/bin',
      NULU_TEST_API_KEY: 'secret',
      NULU_CLIENT_VARIANT: 'quoted "value"',
      NULU_CLIENT_EMPTY: '',
      NULU_CLIENT_UNSET: undefined,
    })).toEqual({
      'process.env': '{}',
      'process.env.NULU_CLIENT_EMPTY': '""',
      'process.env.NULU_CLIENT_VARIANT': '"quoted \\"value\\""',
    })
  })

  it('feeds the same build-process value to dynamic tsdown bundles and the Vite shell', async () => {
    process.env[PROBE_NAME] = 'shared-value'

    const configs = clientBundle('@worldapptechnologies/nulu-client-ui-sidebar', [
      'lib/types/index.js',
      'lib/types/invariant.js',
    ])({ env: { NULU_BUILD_FACE: 'client' } })
    if (!Array.isArray(configs)) throw new TypeError('client bundle config must be an array')
    const dynamic = configs.find(config => config.name === '@worldapptechnologies/nulu-client-ui-sidebar/client')
    expect(dynamic?.define).toMatchObject({
      'process.env': '{}',
      [PROBE_KEY]: '"shared-value"',
    })

    const viteConfigPath = '../apps/web/vite.config.ts'
    const viteModule: unknown = await import(viteConfigPath)
    if (typeof viteModule !== 'object' || viteModule === null) {
      throw new TypeError('web Vite config module must be an object')
    }
    const viteConfig: unknown = Reflect.get(viteModule, 'default')
    if (typeof viteConfig === 'function') throw new TypeError('web Vite config must be an object')
    if (typeof viteConfig !== 'object' || viteConfig === null) {
      throw new TypeError('web Vite config must be an object')
    }
    expect(Reflect.get(viteConfig, 'define')).toMatchObject({
      'process.env': '{}',
      [PROBE_KEY]: '"shared-value"',
    })
  })

  it('binds the recorded environment to a complete set of client artifacts', () => {
    const officialEnvironment = {
      NULU_CLIENT_BUILD_PROFILE: 'official',
      NULU_CLIENT_COMMIT_HASH: COMMIT_HASH.slice(0, 7),
      NULU_CLIENT_TITLE: 'Nulu Harness',
      NULU_CLIENT_VERSION: '1.2.3',
    }
    const official = buildFixture(officialEnvironment)
    const defaultBuild = buildFixture({})

    expect(readClientBuildRecord(official, officialEnvironment).environment).toEqual(officialEnvironment)
    expect(() => { readClientBuildRecord(defaultBuild, officialEnvironment) }).toThrow(/NULU_CLIENT_/)
    expect(() => { readClientBuildRecord(join(defaultBuild, 'missing')) }).toThrow(/record.*missing/)

    write(join(official, 'apps/web/dist/index.html'), '<main>changed</main>')
    expect(() => { readClientBuildRecord(official) }).toThrow(/artifacts differ/)
  })

  it('keeps public client values out of workflow-wide environments', () => {
    for (const name of nuluBuildWorkflows) {
      const path = `.github/workflows/${name}`
      const document: unknown = yaml.load(readFileSync(resolve(root, path), 'utf8'))
      if (typeof document !== 'object' || document === null || Array.isArray(document)) {
        throw new TypeError(`${path} must contain a workflow object`)
      }
      expect(JSON.stringify(document), path).not.toContain('NULU_CLIENT_')
    }
  })
})
