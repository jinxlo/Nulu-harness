# Unit 13 — llm-gateway: durable image offload (CRITICAL)

- **Dependencies:** 10, 11, 12

- **Upstream commits:** 345b5cdc6f; fcb976d3dc; b5e7fca4a5

## Upstream change
packages/llm/llm-deepseek/src/common/{request-files,request-extensions}.ts, packages/session/*

**Intent:** Durable image offload: persist images, watermark, compaction recovery.

## Nulu equivalent
packages/llm/llm-gateway/src/common/*, packages/session/*

**Current behavior:** Nulu has image handling; adapt the durability capability.

## Architectural difference
Generic durability, but upstream watermark is DeepSeek-specific.

## Required Nulu translation
ADAPT: implement durable image offload in the World App gateway without the DeepSeek watermark.

## Preserve
- World App provider
- Nulu session persistence

## Do NOT import
- DeepSeek watermark
- DeepSeek provider

## Protected invariants
- provider abstraction
- session persistence

## Relevant tests
- packages/llm/llm-gateway/tests/* image-offload tests
- packages/session/* tests

## Acceptance
image offload tests pass; validate.mjs PASS; real offload works against World App API.
