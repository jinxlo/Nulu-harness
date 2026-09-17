# Upstream Sync

Nulu Harness is a rebranded fork of DeepSeek Harness. This document describes
how to pull upstream changes and re-apply the Nulu transformation so the fork
stays current without losing the rebrand.

## Layout

```
deepseek-ai/deepseek-harness (upstream)   ← tracked as the `upstream` remote
        │  merge
        ▼
worldapptechnologies/nulu-harness         ← rebrand applied on top
```

The Nulu fork carries two kinds of changes on top of upstream:

1. **Brand/identity** — `dsh` → `nulu`, `@deepseek-ai/*` → `@worldapptechnologies/*`,
   `DSH_*` → `NULU_*`, `~/.dsh` → `~/.nulu`, "DeepSeek Harness" → "Nulu Harness".
2. **Provider replacement** — the DeepSeek provider packages are removed and the
   World App Technologies route (`worldapp` with `nulu-5-ultra` / `nulu-5-pro`)
   is the only servable provider.

## One-time setup

```sh
git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
```

## Syncing

```sh
./scripts/sync-upstream.sh
```

This does `fetch → merge → rebrand → report`. If the merge conflicts, resolve the
conflicts, then run `node scripts/rebrand-upstream.mjs` and commit.

Use `./scripts/sync-upstream.sh --no-merge` to re-run only the rebrand pass.

## What the rebrand pass does

`scripts/rebrand-upstream.mjs` is idempotent and safe to re-run:

- Applies the string mappings (package scope, CLI name, env vars, home dir,
  product name, repo name).
- Deletes the DeepSeek-specific packages Nulu does not ship:
  `packages/llm/llm-deepseek`, `packages/llm/deepseek-llm-api-extensions`,
  `packages/llm/plugin-package-inventory-deepseek`,
  `packages/session/session-log-deepseek`, `packages/web/web-search-deepseek`,
  the `DeepSeekModelsEditor` / `DeepSeekOnboardingDialog` UI, and the Python
  `deepseek_harness_runtime`.
- Never touches `LICENSE`, `THIRD_PARTY_NOTICES`, or the `.agents/notes/` archive.
- Leaves the `thinkingFormat: deepseek` reasoning wire format intact (it is a
  protocol identifier the platform endpoint requires, not a brand reference).

## After syncing — manual steps

The script prints a report of remaining `deepseek` references. Review each:

- **Protocol identifiers** — `thinkingFormat: deepseek`, `'deepseek': true`
  (the reasoning wire format gate). Keep these.
- **Test fixtures** — `packages/llm/llm-pi-ai/tests/*.spec.ts` and
  `apps/web/tests/expected/*.expected.md` still use `deepseek` as an example
  provider/model. These are not user-facing; regenerate web snapshots with the
  normal snapshot command and, if desired, migrate the pi-ai test fixtures to a
  generic provider name.
- **Docs** — `docs/user/guide/providers.md` explains `thinkingFormat: deepseek`;
  that is expected.

Finally run the verification gates that the rebrand relies on:

```sh
pnpm install
pnpm build
pnpm test
```

and confirm the model selector exposes only `nulu-5-ultra` and `nulu-5-pro`.
