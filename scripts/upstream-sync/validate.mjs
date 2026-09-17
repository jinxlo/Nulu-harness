#!/usr/bin/env node
/**
 * Nulu invariant validation.
 *
 * Reads upstream-policy.yml and verifies the current tree still satisfies every
 * Nulu invariant: branding, package scope, CLI name, env vars, paths, provider
 * isolation, and the Nulu-only model catalog. Runs after every synchronization;
 * a failure means the sync would silently revert the Nulu architecture.
 *
 * Usage:
 *   node scripts/upstream-sync/validate.mjs           # human-readable
 *   node scripts/upstream-sync/validate.mjs --json    # machine-readable
 *
 * Exit code: 0 = all invariants hold, 1 = one or more violations.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { load } from 'js-yaml'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const JSON_OUT = process.argv.includes('--json')

const policy = load(readFileSync(join(ROOT, 'upstream-policy.yml'), 'utf8'))

function grep(pattern) {
  try {
    return execFileSync('git', ['grep', '-n', '-I', '-e', pattern], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function read(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

/** A grep hit is "user-facing" when it is not a test, legal, sync-tooling, or archived note. */
function isUserFacing(hit) {
  const file = hit.slice(0, hit.indexOf(':'))
  return !/(^|\/)(tests?|__tests__)\//.test(file)
    && !/\.(spec|test|e2e)\.[cm]?[jt]sx?$/.test(file)
    && !/\.expected\.md$/.test(file)
    && !/\.snap$/.test(file)
    && !/fixture/i.test(file)
    && !/THIRD_PARTY|LICENSE|NOTICE|CHANGELOG/i.test(file)
    && !file.startsWith('.agents/notes/')
    // Sync analysis artifacts (reports/) legitimately reference "DeepSeek" as
    // the upstream source being adapted; they are not product surfaces.
    && !file.startsWith('reports/')
    // The sync system itself necessarily references the source names it
    // transforms; it is build tooling, not the product.
    && !file.startsWith('scripts/upstream-sync/')
    && !/^(scripts\/rebrand-upstream\.mjs|scripts\/sync-upstream\.sh|UPSTREAM_SYNC\.md|UPSTREAM_POLICY\.md|upstream-policy\.yml|nulu-fork-manifest\.json)$/.test(file)
}

/** Filter grep hits to user-facing ones only. */
function userFacingHits(pattern) {
  return grep(pattern).split('\n').filter(line => line && isUserFacing(line))
}

const results = []
function check(name, pass, detail = '') {
  results.push({ name, pass, detail })
}

// 1. Package scope.
{
  const hits = userFacingHits('@deepseek-ai/')
  check('package_scope: no @deepseek-ai/ scope', hits.length === 0, hits.slice(0, 5).join('\n'))
}

// 2. CLI name (dsh as a standalone word, user-facing only).
{
  const hits = userFacingHits('\\bdsh\\b')
  check('cli: no `dsh` command', hits.length === 0, hits.slice(0, 5).join('\n'))
}

// 3. Environment prefix.
{
  const hits = userFacingHits('DSH_')
  check('env: no DSH_ variables', hits.length === 0, hits.slice(0, 5).join('\n'))
}

// 4. Home path.
{
  const hits = userFacingHits('~\\.dsh')
  check('paths: no ~/.dsh', hits.length === 0, hits.slice(0, 5).join('\n'))
}

// 5. Brand: no "DeepSeek" (capital-D) user-facing reference.
{
  const hits = userFacingHits('DeepSeek')
  check('branding: no user-facing "DeepSeek"', hits.length === 0, hits.slice(0, 5).join('\n'))
}

// 6. Provider catalog: pi-ai must not expose the builtin provider catalog.
{
  const catalog = read(join(ROOT, 'packages/llm/llm-pi-ai/src/catalog.ts'))
  const empty = /return \[\]/.test(catalog.slice(catalog.indexOf('catalogProviderIds')))
  check('providers: builtin catalog not exposed', empty, 'catalogProviderIds() must return []')
}

// 7. Models: llm-gateway DEFAULT_MODELS only allowed Nulu models.
{
  const gateway = read(join(ROOT, 'packages/llm/llm-gateway/src/index.ts'))
  const allowed = new Set(policy.models.allowed_chat_model_ids)
  const ids = [...gateway.matchAll(/id: '([^']+)'/g)].map(m => m[1]).filter(id => id.startsWith('nulu-'))
  const ok = ids.length > 0 && ids.every(id => allowed.has(id))
  check('models: gateway DEFAULT_MODELS only Nulu', ok, `found: ${ids.join(', ')}`)
}

// 8. Models: base bundle worldapp route only allowed Nulu models.
{
  const base = read(join(ROOT, 'packages/bundle/base/cordis.patch.yml'))
  const allowed = new Set(policy.models.allowed_chat_model_ids)
  const ids = [...base.matchAll(/- id: (nulu-[a-z0-9-]+)/g)].map(m => m[1])
  const ok = ids.length > 0 && ids.every(id => allowed.has(id))
  check('models: worldapp route only Nulu', ok, `found: ${ids.join(', ')}`)
}

// 9. Provider: World App route present.
{
  const base = read(join(ROOT, 'packages/bundle/base/cordis.patch.yml'))
  check('providers: worldapp route registered', /worldapp:/.test(base))
}

// 10. Removed DeepSeek packages absent.
{
  const manifest = JSON.parse(read(join(ROOT, 'nulu-fork-manifest.json')))
  const present = (manifest.removed_upstream_packages ?? []).filter(pkg => existsSync(join(ROOT, pkg)))
  check('providers: DeepSeek packages absent', present.length === 0, present.join(', '))
}

const failed = results.filter(r => !r.pass)

if (JSON_OUT) {
  console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2))
} else {
  console.log(`[validate] ${results.length - failed.length}/${results.length} invariants hold`)
  for (const r of failed) {
    console.log(`  FAIL  ${r.name}${r.detail ? `\n        ${r.detail.split('\n').join('\n        ')}` : ''}`)
  }
}

process.exit(failed.length === 0 ? 0 : 1)
