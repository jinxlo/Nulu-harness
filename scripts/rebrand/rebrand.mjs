#!/usr/bin/env node
/**
 * Nulu Harness rebrander.
 *
 * Deterministically converts the upstream DeepSeek Harness tree into the
 * World App Technologies "Nulu Harness" identity. The rules are ordered and
 * token-aware so package scopes, CLI/path/env identifiers, and product names
 * move together without corrupting unrelated words ("handshake") or the
 * DeepSeek provider references that this fork still legitimately supports.
 *
 * Usage:
 *   node scripts/rebrand/rebrand.mjs --dry-run   # classify, print summary, write nothing
 *   node scripts/rebrand/rebrand.mjs             # apply (idempotent)
 *
 * The script never rewrites its own directory, so its rule patterns stay
 * executable when a future upstream sync needs a second pass.
 *
 * Legal files (LICENSE, NOTICE, THIRD_PARTY_NOTICES, vendor/native licenses)
 * are never content-rewritten: upstream MIT attribution must survive the fork.
 * Product-identity docs that must be authored, not transformed
 * (BRAND_GUIDELINES.*), and the regenerated pnpm-lock.yaml, are also exempt.
 * `.agents/notes/archived/` is never touched: the repository freezes that tree
 * (content and filenames) under `verify-archived-agent-notes`, so identity
 * tokens there stay historical. The fork's own attribution link to the
 * upstream project is protected verbatim wherever it appears.
 */

import { readdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SELF_DIR = join(ROOT, 'scripts', 'rebrand')
const ARCHIVED_NOTES_DIR = join(ROOT, '.agents', 'notes', 'archived')
const DRY_RUN = process.argv.includes('--dry-run')

/** Directories never descended into. */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.pnpm-store', 'dist', 'lib', '.turbo'])

/** Content never rewritten (upstream legal attribution). */
const LEGAL_BASENAMES = [
  /^LICENSE(\.|$)/,
  /^NOTICE(\.|$)/,
  /^COPYING(\.|$)/,
  /^THIRD_PARTY_NOTICES(\.|$)/,
]

/** Content never rewritten for other reasons (regenerated or manually authored). */
const CONTENT_EXEMPT = new Set([
  'pnpm-lock.yaml',
  'BRAND_GUIDELINES.md',
  'BRAND_GUIDELINES.zh.md',
  'BRAND_GUIDELINES.i18n.yaml',
  'UPSTREAM.md',
])

/**
 * Ordered content rules. Earlier rules consume patterns later rules would
 * otherwise only partially match (scope before bare token, product name before
 * the generic product id, env prefix before bare `DSH`).
 */
export const CONTENT_RULES = [
  // 1. Package scope: dsh-* first, then the bare CLI package, then all remaining
  //    scope references (including bare `@deepseek-ai` prose and generated doc
  //    anchors of the form `#deepseek-ainulu-*`).
  [/@deepseek-ai\/dsh-/g, '@worldapptechnologies/nulu-'],
  [/@deepseek-ai\/dsh\b/g, '@worldapptechnologies/nulu'],
  [/@deepseek-ai\//g, '@worldapptechnologies/'],
  [/@deepseek-ai\b/g, '@worldapptechnologies'],
  [/#deepseek-ai(?=[a-z0-9])/g, '#worldapptechnologies'],
  [/deepseek-ai(?=nulu-)/g, 'worldapptechnologies'],
  // 2. Repository and docs URLs.
  [/deepseek-ai\/deepseek-harness/g, 'worldapptechnologies/nulu-harness'],
  [/deepseek-harness\.github\.io/g, 'worldapptechnologies.github.io/nulu-harness'],
  // 3. Product name, then remaining product-id forms (hyphen and Python underscore).
  [/DeepSeek Harness/g, 'Nulu Harness'],
  [/deepseek-harness/g, 'nulu-harness'],
  [/deepseek_harness/g, 'nulu_harness'],
  // 4. Badge color/logo and the fetch user agent are pinned to upstream imagery.
  [/powered_by-nulu-4D6BFE\?style=flat-square/g, 'powered_by-Nulu_Harness-blue?style=flat-square'],
  [/\bnulu-harness\/0\.0\.1 \(\+https:\/\/github\.com\/deepseek-ai\)/g, 'nulu-harness/0.0.1 (+https://github.com/worldapptechnologies/nulu-harness)'],
  // 4. Environment prefix and identifier stems.
  [/DSH_/g, 'NULU_'],
  [/\bdsh(?=[A-Z])/g, 'nulu'],
  [/\bdsh(?=_)/g, 'nulu'],
  [/dsh-/g, 'nulu-'],
  [/\.dsh\b/g, '.nulu'],
  // 4b. Escape adjacency: JSONL recordings and source string literals spell
  //     control characters as escapes (`\n`, `\r`, `\t`, `\x07`, `\u001b`), so
  //     the escape's last character is a word character and `\b` never matches
  //     there (`\ndsh plugin`). Rewrite those tokens after the escape.
  [/(\\[A-Za-z0-9]+)dsh\b/g, '$1nulu'],
  [/(\\[A-Za-z0-9]+)DSH\b/g, '$1NULU'],
  [/(\\[A-Za-z0-9]+)Dsh\b/g, '$1Nulu'],
  // 5. Remaining bare tokens: CLI name, manifest keys, dirs, badges.
  [/\bdsh\b/g, 'nulu'],
  [/\bDSH\b/g, 'NULU'],
  [/\bDsh\b/g, 'Nulu'],
]

/** Token-aware basename rules for path renames. */
export const RENAME_RULES = [
  [/-dsh-/g, '-nulu-'],
  [/^dsh-/g, 'nulu-'],
  [/^dsh\./g, 'nulu.'],
  [/\.dsh-/g, '.nulu-'],
  [/\.dsh$/g, '.nulu'],
  [/deepseek_harness/g, 'nulu_harness'],
  [/\bdsh\b/g, 'nulu'],
  [/\bDSH\b/g, 'NULU'],
]

/** Relative Markdown links whose target lives in the frozen archive tree. */
const ARCHIVED_LINK = /(?:\.\.\/)+archived\/[^\s)"'`]+\.md(?:#[^\s)"'`]*)?/g

/** Upstream-identity references the fork keeps verbatim for attribution. */
const UPSTREAM_REFERENCES = [
  /\[DeepSeek Harness\]\(https:\/\/github\.com\/deepseek-ai\/deepseek-harness\)/g,
]

/** Patterns masked across the rule pass so rules cannot rewrite them. */
const PROTECTED_PATTERNS = [ARCHIVED_LINK, ...UPSTREAM_REFERENCES]

/** Apply every rule in order, restoring protected spans afterwards. */
function rewrite(text) {
  const held = []
  let masked = text
  for (const pattern of PROTECTED_PATTERNS) {
    masked = masked.replace(pattern, (match) => {
      held.push(match)
      return `\u0000protected-${held.length - 1}\u0000`
    })
  }
  let out = masked
  for (const [pattern, replacement] of CONTENT_RULES) out = out.replace(pattern, replacement)
  return out.replace(/\u0000protected-(\d+)\u0000/g, (_, index) => held[Number(index)])
}

/** Rewrite one basename, or return it unchanged. */
function rewriteBasename(name) {
  let out = name
  for (const [pattern, replacement] of RENAME_RULES) out = out.replace(pattern, replacement)
  return out
}

/** True when this file's content is exempt from rewriting. */
function contentExempt(path) {
  const name = basename(path)
  if (CONTENT_EXEMPT.has(name)) return true
  return LEGAL_BASENAMES.some((pattern) => pattern.test(name))
}

/** Decode utf8 text, or undefined for binary content. */
function decodeText(buffer) {
  const text = buffer.toString('utf8')
  return Buffer.from(text, 'utf8').equals(buffer) ? text : undefined
}

const stats = { scanned: 0, contentChanged: 0, renamed: 0 }
const renameHits = []
const contentHits = []

function walk(dir) {
  if (dir === SELF_DIR || dir === ARCHIVED_NOTES_DIR) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      const current = join(dir, entry.name)
      const next = rewriteBasename(entry.name)
      const renamed = next !== entry.name
      const target = renamed ? join(dir, next) : current
      if (renamed) {
        stats.renamed += 1
        renameHits.push([current, target])
        if (!DRY_RUN) renameSync(current, target)
      }
      walk(DRY_RUN && renamed ? current : target)
      continue
    }
    if (!entry.isFile()) continue
    const file = join(dir, entry.name)
    stats.scanned += 1
    const next = rewriteBasename(entry.name)
    if (next !== entry.name) {
      stats.renamed += 1
      renameHits.push([file, join(dir, next)])
    }
    if (!contentExempt(file)) {
      const buffer = readFileSync(file)
      const text = decodeText(buffer)
      if (text !== undefined) {
        const out = rewrite(text)
        if (out !== text) {
          stats.contentChanged += 1
          contentHits.push(file)
          if (!DRY_RUN) writeFileSync(file, out)
        }
      }
    }
    if (next !== entry.name && !DRY_RUN) renameSync(file, join(dir, next))
  }
}

walk(ROOT)

console.log(`${DRY_RUN ? '[dry-run] ' : ''}scanned ${stats.scanned} files`)
console.log(`${DRY_RUN ? 'would rename' : 'renamed'}: ${stats.renamed}`)
console.log(`${DRY_RUN ? 'would change content in' : 'changed content in'}: ${stats.contentChanged}`)
for (const [from, to] of renameHits.slice(0, 40)) console.log(`  rename ${from.replace(ROOT + '/', '')} -> ${to.replace(ROOT + '/', '')}`)
if (renameHits.length > 40) console.log(`  ... and ${renameHits.length - 40} more renames`)
for (const file of contentHits.slice(0, 40)) console.log(`  content ${file.replace(ROOT + '/', '')}`)
if (contentHits.length > 40) console.log(`  ... and ${contentHits.length - 40} more content changes`)
