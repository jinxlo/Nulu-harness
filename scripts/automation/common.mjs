/** Process and file rules shared by the unattended release jobs. */
import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const REPORT = 'reports/upstream-sync/automation.json'

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
export function assertTrustedFilesUnchanged(base, root = ROOT) {
  const changed = command('git', ['diff', '--no-renames', '--name-only', '-z', base, '--'], { cwd: root }).split('\0')
  const added = command('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }).split('\0')
  const protectedChanges = [...new Set([...changed, ...added].filter(trustedPath))]
  if (protectedChanges.length) throw new Error(`Protected Nulu files changed during qualification: ${protectedChanges.join(', ')}`)
}

/** Run the package manager that launched this process without a shell. */
export function pnpm(args, options = {}) {
  const entry = process.env.npm_execpath
  if (!entry) throw new Error('Run automation through pnpm exec node')
  return command(process.execPath, [entry, ...args], options)
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
    text = text.split(from).join(to)
  }
  return text.replace(/(?<![\w-])dsh(?![\w-])/g, 'nulu')
}
