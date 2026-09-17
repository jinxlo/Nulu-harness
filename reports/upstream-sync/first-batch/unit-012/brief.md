# Unit 12 — llm-gateway: token-grid projection (reject) (MEDIUM)

- **Dependencies:** 10

- **Upstream commits:** 06c491508f

## Upstream change
packages/llm/llm-gateway/src/common/image-tokens.ts

**Intent:** V4.1 token-grid image projection (DeepSeek-specific billing).

## Nulu equivalent
packages/llm/llm-gateway/src/common/image-tokens.ts

**Current behavior:** Nulu uses World App API token accounting.

## Architectural difference
UPSTREAM-PROVIDER-SPECIFIC: V4.1 grid is DeepSeek-specific.

## Required Nulu translation
REJECT the DeepSeek token grid; keep Nulu/World App token accounting.

## Preserve
- Nulu token accounting

## Do NOT import
- V4.1 DeepSeek token grid

## Protected invariants
- Nulu model ids
- World App pricing

## Relevant tests
- packages/llm/llm-gateway/tests/messages/* token tests

## Acceptance
confirm no DeepSeek grid; image token tests pass against World App accounting.
