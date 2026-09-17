# Unit 11 — llm-gateway: Messages protocol reconciliation (MEDIUM)

- **Dependencies:** 9

- **Upstream commits:** 34154b6861; 6a137ea702

## Upstream change
packages/llm/llm-gateway/src/protocols/messages/{adapter,transport,replay}.ts

**Intent:** Anthropic Messages protocol adapter additions.

## Nulu equivalent
packages/llm/llm-gateway/src/protocols/messages/*

**Current behavior:** Nulu already has messages protocol; reconcile upstream additions.

## Architectural difference
Nulu already restructured; upstream added transport/replay.

## Required Nulu translation
ADAPT: reconcile upstream messages additions into Nulu messages protocol without DeepSeek assumptions.

## Preserve
- World App provider
- Nulu messages protocol

## Do NOT import
- DeepSeek message semantics

## Protected invariants
- provider abstraction

## Relevant tests
- packages/llm/llm-gateway/tests/messages/{adapter,stream}.spec.ts

## Acceptance
messages protocol tests pass; validate.mjs PASS.
