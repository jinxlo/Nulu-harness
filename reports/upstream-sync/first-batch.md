# Nulu Upstream Sync — First Adaptation Batch (13 units)

Sync branch: `sync/deepseek-2026-09-17`
Upstream: `c291e7961a51` → `0d1f50007f9b` (467 non-merge commits)
Remaining semantic conflicts after deterministic resolution: **100**

This batch selects 13 units (5 LOW, 5 MEDIUM, 2 HIGH, 1 CRITICAL) to validate the
adaptation pipeline against the **real** merged state before scaling up. Order is
deliberate: LOW/MEDIUM first to prove the pipeline (worktrees, build, tests,
isolation, rollback), then HIGH, then the llm-gateway CRITICAL once confidence
exists.

## Execution contract (per unit)

```
isolated worktree -> read brief -> semantic adaptation -> targeted tests
-> package build -> policy validation -> grep/rebrand checks -> commit -> next
```

A unit that fails validation must not contaminate the next. Use
`scripts/upstream-sync/run-adaptations.mjs` with a real `NULU_ADAPTER_CMD` on the
build machine (Node 24 + pnpm install + native toolchains).

---

# LOW risk (5)

## Unit L1 — e2b/e2b core (API url, index, composition/egress)

- **Upstream commits:** e2b/egress + composition work in the 0.1.6 window
- **Upstream files:** `packages/e2b/e2b/src/api-url.ts`, `src/index.ts`,
  `tests/composition.e2e.ts`, `tests/e2b.spec.ts`, `tests/egress.spec.ts`
- **New behavior:** sandbox API URL handling, egress (network egress) controls,
  composition fixtures.
- **Nulu equivalent:** same package, same path — no rename, no provider coupling.
- **Semantic intent:** port the e2b sandbox API/egress improvements verbatim; this
  is a generic sandboxing capability with no DeepSeek/World App coupling.
- **Protected invariants:** none in policy; must not introduce DeepSeek strings.
- **Acceptance:** `pnpm --filter @worldapptechnologies/nulu-e2b test` passes;
  `validate.mjs` PASS; `git grep -i deepseek -- packages/e2b` empty.

## Unit L2 — e2b/subprocess-e2b (environment, process, terminal, remote, output)

- **Upstream commits:** subprocess sandbox hardening
- **Upstream files:** `packages/e2b/subprocess-e2b/src/{environment,process,terminal,remote,output}.ts`
- **New behavior:** subprocess lifecycle and terminal output streaming.
- **Nulu equivalent:** same package/path.
- **Semantic intent:** port verbatim (generic subprocess sandbox).
- **Protected invariants:** no DeepSeek strings; no provider coupling.
- **Acceptance:** subprocess-e2b tests pass; validate.mjs PASS.

## Unit L3 — e2b/fs-e2b (filesystem)

- **Upstream files:** `packages/e2b/fs-e2b/src/index.ts`, `tests/filesystem.spec.ts`
- **Semantic intent:** port filesystem adapter changes verbatim.
- **Acceptance:** fs-e2b tests pass.

## Unit L4 — workflow-worker-thread (host, protocol, session, worker)

- **Upstream files:** `packages/workflow/workflow-worker-thread/src/{host,protocol,session,worker}.ts`
- **New behavior:** workflow worker session/protocol changes.
- **Semantic intent:** port verbatim (generic workflow runtime).
- **Acceptance:** workflow-worker-thread tests pass.

## Unit L5 — code-runtime-worker-thread (index, worker, budget)

- **Upstream files:** `packages/code-runtime/code-runtime-worker-thread/src/{index,worker}.ts`,
  `tests/{budget,runtime,source-worker.compat}.spec.ts`
- **New behavior:** code-runtime worker budget/runtime changes.
- **Semantic intent:** port verbatim (generic code sandbox).
- **Acceptance:** code-runtime-worker-thread tests pass.

---

# MEDIUM risk (5)

## Unit M1 — client/connection (fixture + client spec)

- **Upstream files:** `packages/client/connection/src/client/fixture.ts`, `tests/fixture.client.spec.ts`
- **New behavior:** connection fixture shape changes.
- **Nulu equivalent:** same package/path.
- **Semantic intent:** port the fixture change; verify it does not alter the
  World App provider connection contract.
- **Protected invariants:** provider abstraction; World App API base URL/key handling.
- **Acceptance:** client/connection tests pass; no change to `worldapp` route.

## Unit M2 — session-log-gateway (config spec)

- **Upstream files:** `packages/session/session-log-gateway/tests/config.spec.ts`
- **New behavior:** session-log config validation changes.
- **Semantic intent:** port; keep Nulu session-log-gateway config defaults (not
  upstream session-log-deepseek defaults).
- **Acceptance:** session-log-gateway tests pass; validate.mjs PASS.

## Unit M3 — app-boot (hmr-config spec)

- **Upstream files:** `packages/boot/app-boot/tests/hmr-config.spec.ts`
- **Semantic intent:** port the HMR config test change (generic boot behavior).
- **Acceptance:** app-boot tests pass.

## Unit M4 — api/session-controller (fake-api client)

- **Upstream files:** `packages/api/session-controller/tests/fake-api.client.ts`
- **Semantic intent:** port the fake-api test double change (generic API test infra).
- **Acceptance:** session-controller tests pass.

## Unit M5 — docs + CI (code-runtime doc, e2b-e2e workflow, i18n README)

- **Upstream files:** `docs/subsystems/code-runtime.md`, `.github/workflows/e2b-e2e.yml`,
  `docs/i18n/README.md`
- **Semantic intent:** port documentation and CI workflow changes; rebrand any
  upstream `dsh`/DeepSeek references to Nulu/World App.
- **Acceptance:** `grep -iE "deepseek|dsh" docs/subsystems/code-runtime.md` empty
  (except intentional history references); validate.mjs PASS.

---

# HIGH risk (2)

## Unit H1 — Rename leftover `subagent-dsh-sdk` → `subagent-nulu-sdk`

- **Finding:** the rebrand renamed `packages/subagent/subagent-dsh-sdk` →
  `packages/subagent/subagent-nulu-sdk`, but upstream kept evolving the old name,
  producing a rename conflict. The old name must NOT be restored.
- **Upstream files:** `packages/subagent/subagent-dsh-sdk/package.json`
- **Nulu equivalent:** `packages/subagent/subagent-nulu-sdk` (already exists).
- **Semantic intent:** reject the `dsh-sdk` package (keep Nulu's rename); port any
  upstream `subagent-dsh-sdk` changes that are generic into `subagent-nulu-sdk`,
  updating package name, imports, workspace refs, and the `subagent-dsh-sdk-dynamic-route`
  snapshot (rename → `subagent-nulu-sdk-dynamic-route`).
- **Protected invariants:** no `dsh`/`deepseek` package names; Nulu SDK keeps the
  World App default model (`nulu-5-ultra`, already set).
- **Acceptance:** `grep -riE "dsh" packages/subagent snapshots/sdk` empty;
  subagent-nulu-sdk builds; validate.mjs PASS.

## Unit H2 — Rename leftover `plugin-package-inventory-deepseek` → `plugin-package-inventory`

- **Finding:** same rename-conflict pattern: upstream kept
  `packages/llm/plugin-package-inventory-deepseek`; Nulu renamed to
  `packages/llm/plugin-package-inventory`.
- **Upstream files:** `packages/llm/plugin-package-inventory-deepseek/package.json`
- **Semantic intent:** reject the `deepseek` name; port generic inventory changes
  into `plugin-package-inventory`.
- **Acceptance:** `grep -riE "deepseek" packages/llm/plugin-package-inventory` empty;
  package builds; validate.mjs PASS.

---

# CRITICAL risk (1)

## Unit C1 — llm-gateway protocol unification (Messages adapter + Files parity + image offload + V4.1 token projection)

- **Upstream commits:** `feat(llm): add DeepSeek Anthropic Messages adapter`,
  `feat(llm): default DeepSeek to Messages with Files parity`,
  `refactor(llm): unify DeepSeek protocol implementations`,
  `feat(session, llm): durable image offload watermark`,
  `fix(llm-deepseek): request image by V4.1 token grid projection`,
  `feat(compaction): record image offload decisions`.
- **Upstream files (llm-deepseek):** `src/protocols/{chat-completions,messages}/*`,
  `src/common/{models,file-store,files-api,image-tokens,request-files,request-pricing,types}.ts`,
  and the flat `src/{types,serialize,translate,sse}.ts` re-exports.
- **Nulu equivalent (llm-gateway):** `src/protocols/chat-completions/*`,
  `src/protocols/messages/*`, `src/common/*` (already restructured into `common/`).
- **What upstream added:** a second protocol (Anthropic Messages) beside
  chat-completions, durable image offload, Files API parity, and V4.1-token-grid
  image projection.
- **Semantic intent (the core rule):** port the *capabilities* — Messages protocol,
  Files API, durable image offload, and V4.1 image token projection — into the
  provider-neutral `llm-gateway` and the **World App Technologies** adapter.
  **Do NOT** copy `llm-deepseek` implementation, **do NOT** restore the DeepSeek
  provider, **do NOT** default to upstream models, **do NOT** reintroduce
  DeepSeek-only reasoning/message assumptions.
- **Protected invariants:**
  - World App Technologies remains the sole provider (`worldapp`).
  - Nulu public model ids (`nulu-5-ultra`, `nulu-5-pro`, `nulu-image-*`) unchanged.
  - `catalogProviderIds()` stays empty (no builtin catalog).
  - No DeepSeek branding/provider/model defaults.
  - `thinkingFormat: deepseek` (wire format) may remain if required by the platform.
  - Policy/manifest files untouched.
- **Acceptance:** llm-gateway unit + e2e tests pass; package build passes;
  `validate.mjs` PASS (10/10); `git grep -iE "deepseek" packages/llm/llm-gateway/src`
  empty except the `thinkingFormat` protocol value; a real Nulu 5 Ultra reasoning +
  tool-call request works end-to-end against the World App API.
- **Status:** `human-review` — mandatory approval before integration; do not auto-merge.

---

# Leftover DeepSeek-named artifacts — classification

| Artifact | Type | Resolution |
|---|---|---|
| `packages/subagent/subagent-dsh-sdk` | runtime package (already renamed to `subagent-nulu-sdk`) | reject old name, port generic changes |
| `packages/llm/plugin-package-inventory-deepseek` | inventory/metadata package (already renamed to `plugin-package-inventory`) | reject old name, port generic changes |
| `snapshots/sdk/subagent-dsh-sdk-dynamic-route` | snapshot (already renamed to `subagent-nulu-sdk-dynamic-route`) | reject old name |

All three are **rename conflicts**, not fresh DeepSeek code: the rebrand renamed
them and upstream kept developing the old names. The correct action is to keep the
Nulu renames and port the upstream changes into the renamed packages (units H1/H2),
then re-verify `grep deepseek/dsh` shows only intentional upstream/history/test refs.

---

## Post-batch report format

After each unit: `Unit | Risk | Area | Result | Tests | Commit`. Then summarize
ported behavior, adaptation approach, remaining open conflicts, reduction from
100 semantic conflicts, and any architectural discoveries.

## Main rule

Optimize for a correct Nulu, never for a green merge. If a unit would restore a
DeepSeek assumption, record it `BLOCKED — ARCHITECTURAL REVIEW` rather than
forcing it.
