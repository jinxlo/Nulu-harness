# Unit 10 — llm-gateway: Files API parity (MEDIUM)

- **Dependencies:** 9

- **Upstream commits:** b0641b83fc; 7d3dab66a2

## Upstream change
packages/llm/llm-gateway/src/common/{files-api,file-store,file-id,upload-index}.ts

**Intent:** Files API parity: upload/attach files through the gateway.

## Nulu equivalent
packages/llm/llm-gateway/src/common/{files-api,file-store,file-id,upload-index}.ts

**Current behavior:** Nulu llm-gateway Files API exists; reconcile upstream additions.

## Architectural difference
Generic capability; DeepSeek-specific file transfer assumptions must be dropped.

## Required Nulu translation
PORT the Files API capability into the World App gateway; the provider sees final file content only.

## Preserve
- World App provider
- Nulu model ids

## Do NOT import
- DeepSeek file transfer specifics

## Protected invariants
- provider abstraction
- Nulu model ids

## Relevant tests
- packages/llm/llm-gateway/tests/messages/files.spec.ts

## Acceptance
llm-gateway files tests pass; validate.mjs PASS; real Files upload works against World App API.
