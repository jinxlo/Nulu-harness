/** Process and file rules shared by the unattended release jobs. */
import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const REPORT = 'reports/upstream-sync/automation.json'

/** Windows upgrade includes removal of the previous bundled runtime and installation of its replacement. */
export const WINDOWS_INSTALL_TIMEOUT_MS = 10 * 60_000

/** Files copied from the trusted Nulu base after importing upstream code. */
export function trustedPath(path) {
  if (/^(?:packages\/client\/ui-primitives\/src\/(?:NuluMark|BrandWordmark)\.tsx|apps\/desktop\/build\/|apps\/desktop\/electron-builder\.config\.mjs$)/.test(path)) return true
  return /^(?:\.github\/|\.agents\/notes\/archived\/|packages\/client\/ui-brand\/|scripts\/automation\/|scripts\/upstream-sync\/|scripts\/(?:sync-upstream\.sh|rebrand-upstream\.mjs)$|(?:upstream-policy\.yml|nulu-fork-manifest\.json|UPSTREAM_POLICY\.md|UPSTREAM_SYNC\.md|AGENTS\.md|CLAUDE\.md)$)/.test(path)
}

/** Read only repository source and public configuration, never credentials or dependency trees. */
export function readablePath(path, root = ROOT) {
  if (typeof path !== 'string' || isAbsolute(path) || path.includes('\\')
    || path.split('/').some(part => part === '..' || part === '.' || part === '' || part.startsWith('.'))
    || /(?:^|\/)node_modules(?:\/|$)/.test(path)
    || (!/^(?:apps|packages|scripts|native|python|docs|vendor)\//.test(path)
      && !/^(?:package\.json|tsconfig[^/]*\.json|pnpm-workspace\.yaml|upstream-policy\.yml|nulu-fork-manifest\.json)$/.test(path))) {
    throw new Error(`Adapter cannot read ${JSON.stringify(path)}`)
  }
  let current = root
  for (const part of path.split('/')) {
    current = join(current, part)
    try {
      if (lstatSync(current).isSymbolicLink()) throw new Error(`Adapter cannot follow symlink ${path}`)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  return join(root, path)
}

/** Tests and policy can guide adaptation but cannot be rewritten to make a candidate pass. */
export function editablePath(path, root = ROOT) {
  const absolute = readablePath(path, root)
  if (trustedPath(path) || !/^(?:apps|packages|scripts|native|python)\//.test(path)
    || /(?:^|\/)(?:tests?|fixtures|snapshots|vendor)(?:\/|$)|\.(?:spec|test|e2e)\./.test(path)
    || /(?:^|\/)(?:AGENTS|CLAUDE|LICENSE|NOTICE|THIRD_PARTY_NOTICES)(?:\.|$)/.test(path)) throw new Error(`Adapter cannot edit ${JSON.stringify(path)}`)
  return absolute
}

/** Capture bounded command output; nonzero status is always an error. */
export function command(executable, args, options = {}) {
  return execFileSync(executable, args, {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    timeout: 30 * 60 * 1000, ...options,
  })
}

export function git(args, options) { return command('git', args, options).trim() }

/** Reject source or build steps that alter protected release controls after restoration. */
export function assertTrustedFilesUnchanged(base, root = ROOT, releaseVersion) {
  const changed = command('git', ['diff', '--no-renames', '--name-only', '-z', base, '--'], { cwd: root }).split('\0')
  const added = command('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }).split('\0')
  const protectedChanges = [...new Set([...changed, ...added].filter(trustedPath))].filter(path => {
    if (path !== 'packages/client/ui-brand/package.json' || !/^\d+\.\d+\.\d+$/.test(releaseVersion ?? '')) return true
    const original = JSON.parse(command('git', ['show', `${base}:${path}`], { cwd: root }))
    const absolute = join(root, path)
    const info = lstatSync(absolute)
    const expected = `${JSON.stringify({ ...original, version: releaseVersion }, null, 2)}\n`
    return !info.isFile() || (info.mode & 0o111) !== 0 || readFileSync(absolute, 'utf8') !== expected
  })
  if (protectedChanges.length) throw new Error(`Protected Nulu files changed during qualification: ${protectedChanges.join(', ')}`)
}

/** Run pnpm without a shell; pnpm exec omits npm_execpath, so POSIX runners use its PATH launcher. */
export function pnpm(args, options = {}) {
  const entry = process.env.npm_execpath
  return entry
    ? command(process.execPath, [entry, ...args], options)
    : command('pnpm', args, options)
}

export function json(path) { return JSON.parse(readFileSync(join(ROOT, path), 'utf8')) }

/** Fixed, ordered transformations; bare protocol identifiers retain their meaning. */
export function brandText(text, { providerFixture = false } = {}) {
  const replacements = [
    ['deepseek-llm-api-extensions', 'llm-api-extensions'],
    ['plugin-package-inventory-deepseek', 'plugin-package-inventory'],
    ['session-log-deepseek', 'session-log-gateway'],
    ['web-search-deepseek', 'web-search-gateway'],
    ['llm-deepseek', 'llm-gateway'],
    ['@deepseek-ai/dsh', '@worldapptechnologies/nulu'],
    ['@deepseek-ai/', '@worldapptechnologies/'],
    ['DeepSeek Harness', 'Nulu Harness'], ['DeepSeek harness', 'Nulu harness'],
    ['deepseek-harness', 'nulu-harness'],
    ['https://api.deepseek.com/anthropic', 'https://platform.worldapptechnologies.com/api'],
    ['https://api.deepseek.com', 'https://platform.worldapptechnologies.com/api/v1'],
    ['DEEPSEEK_API_KEY', 'WORLD_APP_TECHNOLOGIES_API_KEY'],
    ['DEEPSEEK_BASE_URL', 'WORLD_APP_TECHNOLOGIES_BASE_URL'],
    ['DSH_', 'NULU_'], ['~/.dsh', '~/.nulu'],
  ]
  for (const [from, to] of replacements) {
    if (providerFixture && from.startsWith('DEEPSEEK_')) continue
    if (from === 'session-log-deepseek') text = text.replace(/session-log-deepseek(?!\/delivery-accepted\b)/g, to)
    else text = text.split(from).join(to)
  }
  return text.replace(/(?<![\w-])dsh(?![\w-])/g, 'nulu')
}
