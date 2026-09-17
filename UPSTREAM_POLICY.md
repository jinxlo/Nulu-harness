# Upstream Synchronization Policy

Nulu Harness is a downstream product built on DeepSeek Harness technology — not
a renamed Git fork. Synchronization with upstream must let us keep benefiting
from upstream bug fixes, runtime and performance improvements, and new generic
capabilities, **without** reintroducing DeepSeek branding, models, providers,
UI, or product assumptions.

This document is the human-readable explanation of `upstream-policy.yml`
(the machine-readable source of truth consumed by
`scripts/upstream-sync/validate.mjs`).

## Non-negotiable invariants

A synchronization run MUST NOT change any of the following. The validation gate
fails the sync if any invariant is violated.

1. **Branding.** The product is "Nulu Harness" by "World App Technologies".
   No user-facing "DeepSeek" reference may appear. (`thinkingFormat: deepseek`
   and `'deepseek': true` are reasoning wire-format identifiers, not brand
   references, and are allowed.)

2. **Package scope.** Every package is `@worldapptechnologies/*`. No
   `@deepseek-ai/*` package may exist.

3. **CLI.** The CLI is `nulu`, never `dsh`.

4. **Environment.** Variables are `NULU_*`, never `DSH_*`.

5. **Paths.** User data lives under `~/.nulu`, never `~/.dsh`.

6. **Providers.** The harness exposes only the World App Technologies routes
   (`worldapp`, `worldapp-gateway`). pi-ai's bundled third-party provider
   catalog is not exposed, and no DeepSeek/OpenAI/Anthropic/etc. provider route
   may be registered by the shipped bundles.

7. **Models.** The model catalog is supplied by the World App Technologies API.
   The chat selector exposes only `nulu-5-ultra` and `nulu-5-pro`. Upstream
   model definitions are never exposed.

8. **Architecture.** The World App Technologies adapter, the Nulu-only model
   catalog, and the Nulu desktop distribution are preserved.

## How synchronization works

Synchronization never merges upstream directly into `main`. The flow is:

```
upstream/deepseek ──fetch──▶ sync/deepseek-YYYY-MM-DD
                                    │
                     deterministic rebrand (Level 1)
                     classification + protected-file handling (Level 2)
                     semantic adaptation (Level 3, AI-assisted)
                                    │
                     nulu-integration ──validate──▶ report ──approve──▶ main
```

- **Level 1 — deterministic**: `scripts/rebrand-upstream.mjs` (string mappings,
  package deletion, path migration).
- **Level 2 — structural**: `scripts/upstream-sync/classify.mjs` classifies each
  upstream change and applies `nulu-fork-manifest.json` merge strategies.
- **Level 3 — semantic**: an AI agent adapts complex changes while preserving
  the invariants above (future work).

## Protected functionality

The following Nulu functionality is protected from upstream overwrite:

- World App Technologies provider and API endpoint configuration
- Nulu API key handling
- Nulu-only model selector and model catalog
- Removal of DeepSeek provider/model selection
- Nulu branding
- Nulu TUI and web UI customizations
- Nulu desktop application and distribution
- Nulu configuration paths and environment variables

## Approval

A synchronization branch must pass validation and be reviewed by a human before
it is merged into `main`. The system does not push upstream adaptations to
production automatically.
