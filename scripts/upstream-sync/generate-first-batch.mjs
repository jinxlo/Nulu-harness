#!/usr/bin/env node
/**
 * Generate the first adaptation batch package from the REAL merge state.
 *
 * Produces reports/upstream-sync/first-batch/ with:
 *   - execution-plan.json      (ordered units + metadata)
 *   - dependency-map.json      (dependency relationships)
 *   - llm-gateway-capability-map.md  (the 46-conflict decomposition)
 *   - unit-NNN/{brief.md,metadata.json}  per unit
 *
 * This is the handoff artifact: the build machine takes the sync branch, reads
 * these units, and runs them through the adaptation executor without redoing
 * analysis. BRIEF GENERATED != ADAPTATION VALIDATED.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'reports', 'upstream-sync', 'first-batch')

// ---- llm-gateway capability map (the 46-conflict decomposition) ------------
const capabilities = [
  {
    id: 'llm-cap-1',
    capability: 'Anthropic Messages protocol (second protocol beside chat-completions)',
    upstream_commits: ['34154b6861 feat(llm): add DeepSeek Anthropic Messages adapter', 'b0641b83fc feat(llm): default DeepSeek to Messages with Files parity', '6a137ea702 refactor(llm): unify DeepSeek protocol implementations'],
    upstream_files: ['packages/llm/llm-deepseek/src/protocols/messages/*'],
    nulu_equivalent: 'packages/llm/llm-gateway/src/protocols/messages/* (already present)',
    classification: 'ALREADY-PRESENT / ADAPT',
    rationale: 'Nulu llm-gateway already has a messages protocol. Reconcile upstream protocol additions (transport, replay) into it without DeepSeek assumptions.',
  },
  {
    id: 'llm-cap-2',
    capability: 'Files API parity (upload/attach files through the gateway)',
    upstream_commits: ['b0641b83fc feat(llm): default DeepSeek to Messages with Files parity', '7d3dab66a2 fix(llm): harden Messages transport and Files parity'],
    upstream_files: ['packages/llm/llm-deepseek/src/common/{files-api,file-store,file-id,upload-index}.ts'],
    nulu_equivalent: 'packages/llm/llm-gateway/src/common/{files-api,file-store,file-id,upload-index}.ts',
    classification: 'PORT',
    rationale: 'Generic Files API. Port into the World App gateway; the provider only sees final file content.',
  },
  {
    id: 'llm-cap-3',
    capability: 'Durable image offload (persist images, watermark, compaction recovery)',
    upstream_commits: ['345b5cdc6f feat(session, llm): durable image offload watermark', 'fcb976d3dc refactor(llm): recover IMAGE_OFFLOAD_REQUIRED in llm-retry', 'b5e7fca4a5 feat(compaction): record image offload decisions'],
    upstream_files: ['packages/llm/llm-deepseek/src/common/{request-files,request-extensions}.ts', 'packages/session/*'],
    nulu_equivalent: 'packages/llm/llm-gateway/src/common/* + packages/session/*',
    classification: 'ADAPT',
    rationale: 'Image offload is a generic durability capability. Adapt to Nulu without the DeepSeek watermark; keep the World App provider.',
  },
  {
    id: 'llm-cap-4',
    capability: 'V4.1 token-grid image projection (image token accounting)',
    upstream_commits: ['06c491508f fix(llm-deepseek): request image by V4.1 token grid projection'],
    upstream_files: ['packages/llm/llm-deepseek/src/common/image-tokens.ts'],
    nulu_equivalent: 'packages/llm/llm-gateway/src/common/image-tokens.ts',
    classification: 'UPSTREAM-PROVIDER-SPECIFIC',
    rationale: 'The V4.1 token grid is DeepSeek-specific billing. Nulu uses the World App API token accounting; do NOT import the DeepSeek grid.',
  },
  {
    id: 'llm-cap-5',
    capability: 'Reasoning/thinking transport (reasoning_content)',
    upstream_commits: ['(various reasoning passback commits)'],
    upstream_files: ['packages/llm/llm-deepseek/src/protocols/chat-completions/{translate,sse}.ts'],
    nulu_equivalent: 'packages/llm/llm-gateway/src/protocols/chat-completions/* + thinkingFormat: deepseek',
    classification: 'ALREADY-PRESENT',
    rationale: 'Nulu already speaks the reasoning wire format via thinkingFormat: deepseek. Keep it.',
  },
  {
    id: 'llm-cap-6',
    capability: 'Protocol unification / structural reorg (flat src/ -> src/common/)',
    upstream_commits: ['6a137ea702 refactor(llm): unify DeepSeek protocol implementations'],
    upstream_files: ['packages/llm/llm-deepseek/src/{types,serialize,translate,sse}.ts (flat)'],
    nulu_equivalent: 'packages/llm/llm-gateway/src/{types,serialize,translate,sse}.ts -> src/common/* (already restructured)',
    classification: 'ADAPT',
    rationale: 'Nulu already restructured into src/common/. Reconcile the flat re-exports with upstream additions.',
  },
]

// ---- first batch units (dependency-ordered) -------------------------------
const units = [
  {
    id: 1, risk: 'LOW', area: 'e2b/subprocess-e2b', group: 'subprocess-e2b',
    deps: [], commits: ['(subprocess-e2b hardening commits)'],
    upstream_files: ['packages/e2b/subprocess-e2b/src/{environment,process,terminal,remote,output}.ts'],
    nulu_files: ['packages/e2b/subprocess-e2b/src/{environment,process,terminal,remote,output}.ts'],
    upstream_intent: 'Subprocess sandbox lifecycle and terminal output streaming.',
    nulu_behavior: 'Same package/path; no provider coupling.',
    difference: 'None — generic sandboxing.',
    translation: 'Port verbatim.',
    preserve: ['Generic subprocess behavior'],
    do_not_import: ['No DeepSeek/provider assumptions'],
    invariants: ['No DeepSeek strings'],
    tests: ['packages/e2b/subprocess-e2b/tests/subprocess.spec.ts', 'terminal.spec.ts'],
    acceptance: 'subprocess-e2b tests pass; validate.mjs PASS.',
  },
  {
    id: 2, risk: 'LOW', area: 'workflow-worker-thread', group: 'workflow',
    deps: [], commits: ['(workflow session/protocol commits)'],
    upstream_files: ['packages/workflow/workflow-worker-thread/src/{host,protocol,session,worker}.ts'],
    nulu_files: ['packages/workflow/workflow-worker-thread/src/{host,protocol,session,worker}.ts'],
    upstream_intent: 'Workflow worker session/protocol changes.',
    nulu_behavior: 'Same path; generic workflow runtime.',
    difference: 'None.',
    translation: 'Port verbatim.',
    preserve: ['Generic workflow behavior'],
    do_not_import: [],
    invariants: ['No DeepSeek strings'],
    tests: ['packages/workflow/workflow-worker-thread/tests/{session,buit-worker,egress}.spec.ts'],
    acceptance: 'workflow tests pass; validate.mjs PASS.',
  },
  {
    id: 3, risk: 'LOW', area: 'code-runtime-worker-thread', group: 'code-runtime',
    deps: [], commits: ['(code-runtime budget commits)'],
    upstream_files: ['packages/code-runtime/code-runtime-worker-thread/src/{index,worker}.ts'],
    nulu_files: ['packages/code-runtime/code-runtime-worker-thread/src/{index,worker}.ts'],
    upstream_intent: 'Code-runtime worker budget/runtime changes.',
    nulu_behavior: 'Same path; generic code sandbox.',
    difference: 'None.',
    translation: 'Port verbatim.',
    preserve: ['Generic code-runtime behavior'],
    do_not_import: [],
    invariants: ['No DeepSeek strings'],
    tests: ['packages/code-runtime/code-runtime-worker-thread/tests/{budget,runtime}.spec.ts'],
    acceptance: 'code-runtime tests pass; validate.mjs PASS.',
  },
  {
    id: 4, risk: 'MEDIUM', area: 'e2b/e2b', group: 'e2b',
    deps: [1], commits: ['(e2b egress/composition commits)'],
    upstream_files: ['packages/e2b/e2b/src/{api-url,index}.ts', 'tests/{composition,egress,e2b}.spec.ts'],
    nulu_files: ['packages/e2b/e2b/src/{api-url,index}.ts'],
    upstream_intent: 'E2B sandbox API URL handling and egress controls.',
    nulu_behavior: 'Same package; generic sandbox API.',
    difference: 'None.',
    translation: 'Port verbatim.',
    preserve: ['Generic e2b API'],
    do_not_import: [],
    invariants: ['No DeepSeek strings'],
    tests: ['packages/e2b/e2b/tests/{composition,egress}.spec.ts'],
    acceptance: 'e2b tests pass; validate.mjs PASS.',
  },
  {
    id: 5, risk: 'MEDIUM', area: 'e2b/fs-e2b', group: 'fs-e2b',
    deps: [1, 4], commits: ['(fs-e2b commits)'],
    upstream_files: ['packages/e2b/fs-e2b/src/index.ts', 'tests/filesystem.spec.ts'],
    nulu_files: ['packages/e2b/fs-e2b/src/index.ts'],
    upstream_intent: 'E2B filesystem adapter changes.',
    nulu_behavior: 'Same path.',
    difference: 'None.',
    translation: 'Port verbatim.',
    preserve: ['Generic fs-e2b'],
    do_not_import: [],
    invariants: ['No DeepSeek strings'],
    tests: ['packages/e2b/fs-e2b/tests/filesystem.spec.ts'],
    acceptance: 'fs-e2b tests pass.',
  },
  {
    id: 6, risk: 'MEDIUM', area: 'client/connection', group: 'connection',
    deps: [], commits: ['(connection fixture commits)'],
    upstream_files: ['packages/client/connection/src/client/fixture.ts', 'tests/fixture.client.spec.ts'],
    nulu_files: ['packages/client/connection/src/client/fixture.ts'],
    upstream_intent: 'Connection fixture shape changes.',
    nulu_behavior: 'Same path; must not alter World App provider contract.',
    difference: 'None.',
    translation: 'Port; verify the worldapp route is unchanged.',
    preserve: ['World App connection contract (baseURL, apiKey)'],
    do_not_import: [],
    invariants: ['provider abstraction', 'World App base URL/key'],
    tests: ['packages/client/connection/tests/fixture.client.spec.ts'],
    acceptance: 'connection tests pass; worldapp route unchanged.',
  },
  {
    id: 7, risk: 'MEDIUM', area: 'session-log-gateway', group: 'session-log',
    deps: [], commits: ['(session-log config commits)'],
    upstream_files: ['packages/session/session-log-gateway/tests/config.spec.ts'],
    nulu_files: ['packages/session/session-log-gateway/tests/config.spec.ts'],
    upstream_intent: 'Session-log config validation changes.',
    nulu_behavior: 'Nulu session-log-gateway config (not upstream session-log-deepseek defaults).',
    difference: 'Nulu removed session-log-deepseek; keep gateway defaults.',
    translation: 'Port; keep Nulu config defaults.',
    preserve: ['Nulu session-log-gateway defaults'],
    do_not_import: ['session-log-deepseek defaults'],
    invariants: ['No DeepSeek provider'],
    tests: ['packages/session/session-log-gateway/tests/config.spec.ts'],
    acceptance: 'session-log tests pass.',
  },
  {
    id: 8, risk: 'HIGH', area: 'rename leftover subagent-dsh-sdk', group: 'subagent-dsh-sdk',
    deps: [], commits: ['(subagent-dsh-sdk upstream evolution)'],
    upstream_files: ['packages/subagent/subagent-dsh-sdk/package.json'],
    nulu_files: ['packages/subagent/subagent-nulu-sdk (already renamed)'],
    upstream_intent: 'Subagent SDK continued development under the old name.',
    nulu_behavior: 'Already renamed to subagent-nulu-sdk with World App default model.',
    difference: 'Rename conflict — the old name must not return.',
    translation: 'Reject subagent-dsh-sdk; port generic SDK changes into subagent-nulu-sdk.',
    preserve: ['Nulu rename', 'nulu-5-ultra default model'],
    do_not_import: ['dsh name', 'DeepSeek SDK assumptions'],
    invariants: ['No dsh/deepseek package names', 'Nulu default model'],
    tests: ['subagent-nulu-sdk tests'],
    acceptance: 'grep -riE "dsh" packages/subagent empty; subagent-nulu-sdk builds.',
  },
  {
    id: 9, risk: 'HIGH', area: 'rename leftover plugin-package-inventory-deepseek', group: 'plugin-package-inventory-deepseek',
    deps: [], commits: ['(inventory upstream evolution)'],
    upstream_files: ['packages/llm/plugin-package-inventory-deepseek/package.json'],
    nulu_files: ['packages/llm/plugin-package-inventory (already renamed)'],
    upstream_intent: 'DeepSeek plugin inventory continued under old name.',
    nulu_behavior: 'Already renamed to plugin-package-inventory.',
    difference: 'Rename conflict.',
    translation: 'Reject deepseek name; port generic inventory changes into plugin-package-inventory.',
    preserve: ['Nulu rename'],
    do_not_import: ['deepseek name'],
    invariants: ['No deepseek package names'],
    tests: ['plugin-package-inventory tests'],
    acceptance: 'grep -riE "deepseek" packages/llm/plugin-package-inventory empty.',
  },
  {
    id: 10, risk: 'MEDIUM', area: 'llm-gateway: Files API parity', group: 'llm-gateway-files',
    deps: [9], commits: ['b0641b83fc', '7d3dab66a2'],
    upstream_files: ['packages/llm/llm-deepseek/src/common/{files-api,file-store,file-id,upload-index}.ts'],
    nulu_files: ['packages/llm/llm-gateway/src/common/{files-api,file-store,file-id,upload-index}.ts'],
    upstream_intent: 'Files API parity: upload/attach files through the gateway.',
    nulu_behavior: 'Nulu llm-gateway Files API exists; reconcile upstream additions.',
    difference: 'Generic capability; DeepSeek-specific file transfer assumptions must be dropped.',
    translation: 'PORT the Files API capability into the World App gateway; the provider sees final file content only.',
    preserve: ['World App provider', 'Nulu model ids'],
    do_not_import: ['DeepSeek file transfer specifics'],
    invariants: ['provider abstraction', 'Nulu model ids'],
    tests: ['packages/llm/llm-gateway/tests/messages/files.spec.ts'],
    acceptance: 'llm-gateway files tests pass; validate.mjs PASS; real Files upload works against World App API.',
  },
  {
    id: 11, risk: 'MEDIUM', area: 'llm-gateway: Messages protocol reconciliation', group: 'llm-gateway-messages',
    deps: [9], commits: ['34154b6861', '6a137ea702'],
    upstream_files: ['packages/llm/llm-deepseek/src/protocols/messages/{adapter,transport,replay}.ts'],
    nulu_files: ['packages/llm/llm-gateway/src/protocols/messages/*'],
    upstream_intent: 'Anthropic Messages protocol adapter additions.',
    nulu_behavior: 'Nulu already has messages protocol; reconcile upstream additions.',
    difference: 'Nulu already restructured; upstream added transport/replay.',
    translation: 'ADAPT: reconcile upstream messages additions into Nulu messages protocol without DeepSeek assumptions.',
    preserve: ['World App provider', 'Nulu messages protocol'],
    do_not_import: ['DeepSeek message semantics'],
    invariants: ['provider abstraction'],
    tests: ['packages/llm/llm-gateway/tests/messages/{adapter,stream}.spec.ts'],
    acceptance: 'messages protocol tests pass; validate.mjs PASS.',
  },
  {
    id: 12, risk: 'MEDIUM', area: 'llm-gateway: token-grid projection (reject)', group: 'llm-gateway-tokens',
    deps: [10], commits: ['06c491508f'],
    upstream_files: ['packages/llm/llm-deepseek/src/common/image-tokens.ts'],
    nulu_files: ['packages/llm/llm-gateway/src/common/image-tokens.ts'],
    upstream_intent: 'V4.1 token-grid image projection (DeepSeek-specific billing).',
    nulu_behavior: 'Nulu uses World App API token accounting.',
    difference: 'UPSTREAM-PROVIDER-SPECIFIC: V4.1 grid is DeepSeek-specific.',
    translation: 'REJECT the DeepSeek token grid; keep Nulu/World App token accounting.',
    preserve: ['Nulu token accounting'],
    do_not_import: ['V4.1 DeepSeek token grid'],
    invariants: ['Nulu model ids', 'World App pricing'],
    tests: ['packages/llm/llm-gateway/tests/messages/* token tests'],
    acceptance: 'confirm no DeepSeek grid; image token tests pass against World App accounting.',
  },
  {
    id: 13, risk: 'CRITICAL', area: 'llm-gateway: durable image offload', group: 'llm-gateway-offload',
    deps: [10, 11, 12], commits: ['345b5cdc6f', 'fcb976d3dc', 'b5e7fca4a5'],
    upstream_files: ['packages/llm/llm-deepseek/src/common/{request-files,request-extensions}.ts', 'packages/session/*'],
    nulu_files: ['packages/llm/llm-gateway/src/common/*', 'packages/session/*'],
    upstream_intent: 'Durable image offload: persist images, watermark, compaction recovery.',
    nulu_behavior: 'Nulu has image handling; adapt the durability capability.',
    difference: 'Generic durability, but upstream watermark is DeepSeek-specific.',
    translation: 'ADAPT: implement durable image offload in the World App gateway without the DeepSeek watermark.',
    preserve: ['World App provider', 'Nulu session persistence'],
    do_not_import: ['DeepSeek watermark', 'DeepSeek provider'],
    invariants: ['provider abstraction', 'session persistence'],
    tests: ['packages/llm/llm-gateway/tests/* image-offload tests', 'packages/session/* tests'],
    acceptance: 'image offload tests pass; validate.mjs PASS; real offload works against World App API.',
  },
]

// ---- generate files --------------------------------------------------------
mkdirSync(OUT, { recursive: true })

const capabilityMd = ['# llm-gateway capability map\n', 'The 46 llm-gateway conflicts decompose into these capabilities (adapt functionality, not files):\n']
for (const c of capabilities) {
  capabilityMd.push(`## ${c.capability}\n`)
  capabilityMd.push(`- **Classification:** ${c.classification}\n- **Upstream commits:** ${c.upstream_commits.join('; ')}\n- **Upstream files:** ${c.upstream_files.join(', ')}\n- **Nulu equivalent:** ${c.nulu_equivalent}\n- **Rationale:** ${c.rationale}\n`)
}
writeFileSync(join(OUT, 'llm-gateway-capability-map.md'), capabilityMd.join('\n'))

const plan = {
  sync_branch: 'sync/deepseek-2026-09-17',
  upstream_base: 'c291e7961a51',
  upstream_target: '0d1f50007f9b',
  status: 'BRIEF_GENERATED (not adapted/validated — build machine required)',
  units: units.map(u => ({
    id: u.id, risk: u.risk, area: u.area, group: u.group,
    deps: u.deps, upstream_files: u.upstream_files,
    classification: u.risk === 'CRITICAL' ? 'HUMAN ARCHITECTURAL DECISION' : (u.area.startsWith('llm-gateway') ? 'PORT/ADAPT' : 'PORT'),
  })),
}
writeFileSync(join(OUT, 'execution-plan.json'), JSON.stringify(plan, null, 2) + '\n')

const depMap = {
  description: 'Dependency graph: unit id -> depends on unit ids. Process in dependency order; do NOT re-sort by risk.',
  edges: Object.fromEntries(units.map(u => [u.id, u.deps])),
  order: units.map(u => u.id),
}
writeFileSync(join(OUT, 'dependency-map.json'), JSON.stringify(depMap, null, 2) + '\n')

for (const u of units) {
  const dir = join(OUT, `unit-${String(u.id).padStart(3, '0')}`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'metadata.json'), JSON.stringify({
    id: u.id, risk: u.risk, area: u.area, group: u.group, deps: u.deps,
    upstream_commits: u.commits, status: 'BRIEF_GENERATED', confidence: 'UNVALIDATED',
  }, null, 2) + '\n')
  const brief = [
    `# Unit ${u.id} — ${u.area} (${u.risk})\n`,
    `- **Dependencies:** ${u.deps.length ? u.deps.join(', ') : 'none'}\n`,
    `- **Upstream commits:** ${u.commits.join('; ')}\n`,
    `## Upstream change\n${u.upstream_files.join(', ')}\n\n**Intent:** ${u.upstream_intent}\n`,
    `## Nulu equivalent\n${u.nulu_files.join(', ')}\n\n**Current behavior:** ${u.nulu_behavior}\n`,
    `## Architectural difference\n${u.difference}\n`,
    `## Required Nulu translation\n${u.translation}\n`,
    `## Preserve\n- ${u.preserve.join('\n- ')}\n`,
    `## Do NOT import\n- ${u.do_not_import.join('\n- ')}\n`,
    `## Protected invariants\n- ${u.invariants.join('\n- ')}\n`,
    `## Relevant tests\n- ${u.tests.join('\n- ')}\n`,
    `## Acceptance\n${u.acceptance}\n`,
  ].join('\n')
  writeFileSync(join(dir, 'brief.md'), brief)
}

console.log(`[generate-first-batch] ${units.length} units written to ${OUT}`)
console.log(`[generate-first-batch] llm-gateway capabilities: ${capabilities.length} (${capabilities.map(c => c.classification).join(', ')})`)
