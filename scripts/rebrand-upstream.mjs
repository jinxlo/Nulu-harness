#!/usr/bin/env node
/**
 * Rebrand a merged upstream (DeepSeek Harness) tree into Nulu Harness.
 *
 * Upstream sync is not a plain find/replace: DeepSeek Harness ships provider
 * packages and DeepSeek-branded identifiers that Nulu removed/renamed. This
 * script:
 *
 *   1. applies the DeepSeek -> Nulu string mappings (package scope, package
 *      names, directory paths, brand, CLI, env vars, home paths, identifiers)
 *   2. deletes the DeepSeek-specific packages Nulu does not carry
 *   3. prints a report of remaining "deepseek" references for manual review
 *
 * It is idempotent and safe to re-run. It never touches the MIT license or
 * third-party notices, never rewrites itself or the sync tooling, and preserves
 * the `thinkingFormat: deepseek` reasoning wire format (a protocol identifier,
 * not a brand reference).
 *
 * Usage:
 *   node scripts/rebrand-upstream.mjs            # transform the working tree
 *   node scripts/rebrand-upstream.mjs --check    # report only, no writes
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const CHECK_ONLY = process.argv.includes('--check')

/**
 * Ordered, most-specific-first literal replacements (DeepSeek -> Nulu).
 * NOTE: the protocol identifiers `thinkingFormat: deepseek` and `'deepseek': true`
 * are protected in applyToString before these run and restored after, so the
 * provider rename below does not clobber the wire format.
 */
const STRING_REPLACEMENTS = [
  ['@deepseek-ai/dsh', '@worldapptechnologies/nulu'],
  ['@deepseek-ai/', '@worldapptechnologies/'],
  // DeepSeek provider packages Nulu renamed (directory + package name).
  ['deepseek-llm-api-extensions', 'llm-api-extensions'],
  ['plugin-package-inventory-deepseek', 'plugin-package-inventory'],
  ['session-log-deepseek', 'session-log-gateway'],
  ['web-search-deepseek', 'web-search-gateway'],
  ['llm-deepseek', 'llm-gateway'],
  // Brand and identifiers.
  ['DeepSeek Harness', 'Nulu Harness'],
  ['DeepSeek harness', 'Nulu harness'],
  ['DeepSeek', 'Nulu'],
  ['deepseek-harness', 'nulu-harness'],
  ['deepseek-ai', 'worldapptechnologies'],
  ['deepseek', 'nulu'],
  ['Deepseek', 'Nulu'],
  ['deepSeek', 'nulu'],
  ['DEEPSEEK_API_KEY', 'WORLD_APP_TECHNOLOGIES_API_KEY'],
  ['DEEPSEEK_BASE_URL', 'WORLD_APP_TECHNOLOGIES_BASE_URL'],
  ['DEEPSEEK', 'NULU'],
  ['DSH_', 'NULU_'],
  ['~/.dsh', '~/.nulu'],
  ['npx dsh', 'npx nulu'],
  ['dsh', 'nulu'],
  ['Dsh', 'Nulu'],
]

/**
 * Directories removed by the rebrand. Upstream reintroduces them on merge;
 * they are deleted again here. These are DeepSeek-provider packages, not brand
 * assets — Nulu serves the World App Technologies route instead.
 */
const REMOVED_PATHS = [
  'packages/llm/llm-deepseek',
  'packages/llm/deepseek-llm-api-extensions',
  'packages/llm/plugin-package-inventory-deepseek',
  'packages/session/session-log-deepseek',
  'packages/web/web-search-deepseek',
  'packages/client/ui-settings-models/src/client/DeepSeekModelsEditor.tsx',
  'packages/client/ui-settings-models/src/client/DeepSeekModelsEditor.module.css',
  'packages/client/ui-settings-models/src/client/DeepSeekOnboardingDialog.tsx',
  'packages/client/ui-settings-models/src/client/DeepSeekOnboardingDialog.module.css',
  'python/sdk-runtime/src/deepseek_harness_runtime',
]

/** Legal / notice files, archived notes, and the sync tooling itself (kept verbatim). */
const SKIP_PATTERNS = [/^LICENSE(\.\w+)?$/i, /NOTICE/i, /THIRD_PARTY/i, /CHANGELOG/i]

function shouldSkipFile(path) {
  if (path.startsWith('.agents/notes/')) return true // sealed historical archive
  if (path.startsWith('scripts/upstream-sync/')) return true // sync tooling
  if (path === 'scripts/rebrand-upstream.mjs' || path === 'scripts/sync-upstream.sh') return true // self
  if (path === 'upstream-policy.yml' || path === 'UPSTREAM_POLICY.md') return true
  if (path === 'nulu-fork-manifest.json' || path === 'UPSTREAM_SYNC.md') return true
  if (path.startsWith('reports/')) return true // analysis artifacts
  const base = path.split('/').pop() ?? path
  return SKIP_PATTERNS.some(pattern => pattern.test(base))
}

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
  } catch {
    return []
  }
}

function applyToString(text) {
  let result = text
  // Protect protocol identifiers from the provider rename.
  result = result.split('thinkingFormat: deepseek').join('thinkingFormat: __NULU_PROTO__')
  result = result.split("'deepseek': true").join("'__NULU_PROTO__': true")
  result = result.split('"deepseek": true').join('"__NULU_PROTO__": true')
  for (const [from, to] of STRING_REPLACEMENTS) {
    result = result.split(from).join(to)
  }
  result = result.split('__NULU_PROTO__').join('deepseek')
  return result
}

let changedFiles = 0
let removedPaths = 0

for (const path of trackedFiles()) {
  if (shouldSkipFile(path)) continue

  let removed = false
  for (const removedPath of REMOVED_PATHS) {
    if (path === removedPath || path.startsWith(`${removedPath}/`)) {
      removed = true
      break
    }
  }
  if (removed) continue

  let content
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    continue // binary or unreadable
  }

  const next = applyToString(content)
  if (next !== content) {
    if (!CHECK_ONLY) writeFileSync(path, next)
    changedFiles += 1
  }
}

if (!CHECK_ONLY) {
  for (const removedPath of REMOVED_PATHS) {
    try {
      execFileSync('git', ['rm', '-r', '--quiet', '--ignore-unmatch', removedPath], { stdio: 'ignore' })
      removedPaths += 1
    } catch {
      // already absent
    }
  }
}

const remaining = (() => {
  try {
    const out = execFileSync(
      'git', ['grep', '-n', '-I', '-e', 'deepseek', '-e', 'DeepSeek', '-e', 'dsh', '--',
        ':!THIRD_PARTY_NOTICES.md', ':!LICENSE*', ':!.agents/notes/', ':!scripts/', ':!reports/',
        ':!upstream-policy.yml', ':!UPSTREAM_POLICY.md', ':!nulu-fork-manifest.json', ':!UPSTREAM_SYNC.md',
      ], { encoding: 'utf8' },
    )
    return out.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
})()

console.log(`[rebrand-upstream] ${CHECK_ONLY ? 'check' : 'applied'}: ${changedFiles} file(s) rewritten, ${removedPaths} path(s) removed`)
if (remaining.length > 0) {
  console.log(`[rebrand-upstream] ${remaining.length} remaining "deepseek/dsh" reference(s):`)
  for (const line of remaining.slice(0, 40)) console.log(`  ${line}`)
  if (remaining.length > 40) console.log(`  …and ${remaining.length - 40} more`)
} else {
  console.log('[rebrand-upstream] no remaining references.')
}
