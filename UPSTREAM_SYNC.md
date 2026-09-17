# Upstream Adaptation System

Nulu Harness is a downstream product built on DeepSeek Harness technology — not
a renamed Git fork. This system pulls upstream changes, classifies them,
adapts the useful ones to the Nulu architecture, and proves the Nulu invariants
survived — never merging upstream directly into `main`.

## Pipeline

```
upstream/deepseek ──fetch──▶ sync/deepseek-YYYY-MM-DD
                                    │
                     classify (analyze before modifying)
                     risk-detect (CRITICAL/HIGH/MEDIUM/LOW)
                     semantic-adapt (group + briefs for the AI agent)
                     merge
                     rebrand (Level 1 deterministic)
                     validate (invariant gate)
                     report (audit trail)
                                    │
                     nulu-integration ──human approve──▶ main
```

## One-time setup

```sh
git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
```

## Running a sync

```sh
./scripts/sync-upstream.sh                # full pipeline (creates sync branch)
./scripts/sync-upstream.sh --classify-only  # analyze + briefs, no changes
```

The script never touches `main`. It creates `sync/deepseek-<date>`, analyzes,
prepares adaptation briefs, merges, rebrands, validates, and reports. Review and
merge manually:

```sh
git diff main...sync/deepseek-<date>
git checkout main && git merge --no-ff sync/deepseek-<date>
```

## The three adaptation levels

- **Level 1 — deterministic** (`scripts/rebrand-upstream.mjs`): string mappings
  (`dsh` → `nulu`, `@deepseek-ai/*` → `@worldapptechnologies/*`, `DSH_*` →
  `NULU_*`, `~/.dsh` → `~/.nulu`, "DeepSeek Harness" → "Nulu Harness"), package
  deletion, path migration. Idempotent and safe to re-run.
- **Level 2 — structural** (`scripts/upstream-sync/classify.mjs`): classifies
  each commit by type and touched paths and assigns an action
  (`AUTO-PORT`, `PORT-PRESERVE-NULU`, `PORT-WITH-ADAPTATION`,
  `IGNORE-PROVIDER`, `REBRAND-OR-IGNORE`, `REVIEW`), flagging commits that
  touch protected fork files.
- **Level 3 — semantic** (`scripts/upstream-sync/semantic-adapt.mjs`): groups
  related commits into feature units, runs the high-risk detector
  (`risk-detect.mjs`), and produces a context brief
  (`prepare-adaptation.mjs`) per unit for an AI agent. The agent reimplements
  upstream functionality while preserving the Nulu invariants — it adapts
  functionality, not implementation.

## High-risk detection

`scripts/upstream-sync/risk-detect.mjs` maps upstream paths to foundational
areas (`risk-areas.mjs`) and cross-references the fork manifest. Risk levels:

- **CRITICAL** — touches a foundational area and a Nulu-protected file; blocks
  automatic merge and requires semantic adaptation + validation + review.
- **HIGH** — touches a foundational area with Nulu-protected dependencies.
- **MEDIUM** — touches a foundational area with no protected dependencies.
- **LOW** — no foundational area.

## Adaptation history

`scripts/upstream-sync/semantic-adapt.mjs` writes adaptation records to
`reports/upstream-sync/adaptations/` (see
`scripts/upstream-sync/ADAPTATION_HISTORY.md` and
`adaptation-record.template.json`). Each record captures the upstream intent,
the Nulu translation, confidence, validation, and human review, so future
changes to the same component can reuse prior adaptations.

## Invariants and protected files

- `upstream-policy.yml` — machine-readable invariants consumed by the validator.
- `UPSTREAM_POLICY.md` — the human-readable explanation.
- `nulu-fork-manifest.json` — files Nulu materially changed, with their merge
  strategies and the DeepSeek packages Nulu removed.

`scripts/upstream-sync/validate.mjs` runs after every sync and fails if any
invariant is broken, so a merge cannot silently restore DeepSeek branding,
providers, or models.

## Report

`scripts/upstream-sync/report.mjs` writes an auditable report to
`reports/upstream-sync/sync-<timestamp>.json` summarizing the classification
and validation results.

## Manual review after syncing

- Regenerate web snapshots (`apps/web/tests/expected/*.expected.md` still use
  `deepseek` as an example model).
- Optionally migrate the pi-ai test fixtures off the `deepseek` provider name.
- Review any commit the classifier marked `REVIEW` or `touchingProtected`.
