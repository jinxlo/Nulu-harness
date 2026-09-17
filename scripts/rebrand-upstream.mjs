#!/usr/bin/env node
/**
 * Rebrand a merged upstream (Nulu Harness) tree into Nulu Harness.
 *
 * Upstream sync is not a plain find/replace: Nulu Harness ships provider
 * packages (llm-deepseek, deepseek-llm-api-extensions, web-search-deepseek,
 * session-log-deepseek, plugin-package-inventory-deepseek) and model-editor
 * UI that Nulu Harness intentionally removed. This script:
 *
 *   1. applies the DeepSeek -> World App Technologies / Nulu string mappings
 *   2. deletes the DeepSeek-specific packages Nulu does not carry
 *   3. prints a report of remaining "deepseek" references for manual review
 *
 * It is idempotent and safe to re-run. It never touches the MIT license or
 * third-party notices, and it leaves the `thinkingFormat: deepseek` reasoning
 * wire format (and other bare lowercase protocol identifiers) intact.
 *
 * Usage:
 *   node scripts/rebrand-upstream.mjs            # transform the working tree
 *   node scripts/rebrand-upstream.mjs --check    # report only, no writes
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const CHECK_ONLY = process.argv.includes('--check')

/** Ordered, most-specific-first literal replacements. */
const STRING_REPLACEMENTS = [
  ['@worldapptechnologies/nulu', '@worldapptechnologies/nulu'],
  ['@worldapptechnologies/', '@worldapptechnologies/'],
  ['Nulu Harness', 'Nulu Harness'],
  ['Nulu harness', 'Nulu harness'],
  ['nulu-harness', 'nulu-harness'],
  ['worldapptechnologies', 'worldapptechnologies'],
  ['NULU_', 'NULU_'],
  ['~/.nulu', '~/.nulu'],
  ['npx nulu', 'npx nulu'],
]

/** Word-boundary CLI/package-prefix rename, applied after literal replacements. */
const REGEX_REPLACEMENTS = [
  [/\bdsh\b/g, 'nulu'],
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

/** Legal / notice files that must keep upstream attribution verbatim. */
const SKIP_FILES = [/^LICENSE(\.\w+)?$/i, /NOTICE/i, /THIRD_PARTY/i, /CHANGELOG/i]

function trackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
      .split('\0')
      .filter(Boolean)
  } catch {
    return []
  }
}

function shouldSkipFile(path) {
  if (path.startsWith('.agents/notes/')) return true // sealed historical archive
  const base = path.split('/').pop() ?? path
  return SKIP_FILES.some(pattern => pattern.test(base))
}

function applyToString(text) {
  let result = text
  for (const [from, to] of STRING_REPLACEMENTS) {
    result = result.split(from).join(to)
  }
  for (const [regex, to] of REGEX_REPLACEMENTS) {
    result = result.replace(regex, to)
  }
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

// Remove DeepSeek-specific package directories (checked above via git ls-files,
// so files under them are skipped; delete the tree itself here).
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
    const out = execFileSync('git', ['grep', '-n', '-I', '-e', 'deepseek', '-e', 'DeepSeek', '--', ':!THIRD_PARTY_NOTICES.md', ':!LICENSE*'], { encoding: 'utf8' })
    return out.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
})()

console.log(`[rebrand-upstream] ${CHECK_ONLY ? 'check' : 'applied'}: ${changedFiles} file(s) rewritten, ${removedPaths} path(s) removed`)
if (remaining.length > 0) {
  console.log(`[rebrand-upstream] ${remaining.length} remaining "deepseek" reference(s) need manual review:`)
  for (const line of remaining.slice(0, 40)) {
    console.log(`  ${line}`)
  }
  if (remaining.length > 40) console.log(`  …and ${remaining.length - 40} more`)
} else {
  console.log('[rebrand-upstream] no remaining "deepseek" references.')
}
