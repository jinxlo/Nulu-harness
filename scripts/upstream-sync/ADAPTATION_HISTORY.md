# Adaptation history

Every semantic adaptation is recorded as a JSON file in this directory, named
`adaptation-<NNNN>.json`. The record is the fork's memory of how DeepSeek
architecture has historically been translated into Nulu architecture; when
upstream changes the same component again, the semantic adapter can look here
first.

## Record fields

See `scripts/upstream-sync/adaptation-record.template.json`.

- `id` — sequential adaptation id.
- `group_key` — feature-group key from `group.mjs`.
- `upstream_commits` — the upstream commit hashes being adapted.
- `classification` — the `classify.mjs` action.
- `risk` — the `risk-detect.mjs` level (LOW/MEDIUM/HIGH/CRITICAL).
- `confidence` — `HIGH` (adapted with certainty) or `LOW` (must be human-reviewed).
- `upstream_functionality` — what upstream actually added (intent).
- `nulu_adaptation` — how Nulu reimplemented it (translation, not copy).
- `files_changed` — Nulu files modified by the adaptation.
- `tests_added` — tests added or updated.
- `invariants_affected` — Nulu invariants touched (should normally be empty).
- `validation` — result of `scripts/upstream-sync/validate.mjs` after adaptation.
- `status` — `adapted`, `blocked`, or `needs-review`.
- `blocked_reason` — when an upstream feature conflicts with a Nulu invariant,
  the adaptation is BLOCKED and a manual architectural decision is required.
- `human_review` — whether a human must approve before integration.
- `corrections` — later fixes applied after initial adaptation.

## Rules

- **Adapt code to Nulu, never Nulu's policy to upstream.** `upstream-policy.yml`
  is authoritative. If an upstream feature fundamentally conflicts with a Nulu
  invariant, the record is `status: blocked`, not a policy edit.
- **Low-confidence adaptations never auto-continue toward integration.**
  `confidence: LOW` implies `human_review: true`.
