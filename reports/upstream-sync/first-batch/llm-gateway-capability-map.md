# llm-gateway capability map

The 46 llm-gateway conflicts decompose into these capabilities (adapt functionality, not files):

## Anthropic Messages protocol (second protocol beside chat-completions)

- **Classification:** ALREADY-PRESENT / ADAPT
- **Upstream commits:** 34154b6861 feat(llm): add DeepSeek Anthropic Messages adapter; b0641b83fc feat(llm): default DeepSeek to Messages with Files parity; 6a137ea702 refactor(llm): unify DeepSeek protocol implementations
- **Upstream files:** packages/llm/llm-deepseek/src/protocols/messages/*
- **Nulu equivalent:** packages/llm/llm-gateway/src/protocols/messages/* (already present)
- **Rationale:** Nulu llm-gateway already has a messages protocol. Reconcile upstream protocol additions (transport, replay) into it without DeepSeek assumptions.

## Files API parity (upload/attach files through the gateway)

- **Classification:** PORT
- **Upstream commits:** b0641b83fc feat(llm): default DeepSeek to Messages with Files parity; 7d3dab66a2 fix(llm): harden Messages transport and Files parity
- **Upstream files:** packages/llm/llm-deepseek/src/common/{files-api,file-store,file-id,upload-index}.ts
- **Nulu equivalent:** packages/llm/llm-gateway/src/common/{files-api,file-store,file-id,upload-index}.ts
- **Rationale:** Generic Files API. Port into the World App gateway; the provider only sees final file content.

## Durable image offload (persist images, watermark, compaction recovery)

- **Classification:** ADAPT
- **Upstream commits:** 345b5cdc6f feat(session, llm): durable image offload watermark; fcb976d3dc refactor(llm): recover IMAGE_OFFLOAD_REQUIRED in llm-retry; b5e7fca4a5 feat(compaction): record image offload decisions
- **Upstream files:** packages/llm/llm-deepseek/src/common/{request-files,request-extensions}.ts, packages/session/*
- **Nulu equivalent:** packages/llm/llm-gateway/src/common/* + packages/session/*
- **Rationale:** Image offload is a generic durability capability. Adapt to Nulu without the DeepSeek watermark; keep the World App provider.

## V4.1 token-grid image projection (image token accounting)

- **Classification:** UPSTREAM-PROVIDER-SPECIFIC
- **Upstream commits:** 06c491508f fix(llm-deepseek): request image by V4.1 token grid projection
- **Upstream files:** packages/llm/llm-deepseek/src/common/image-tokens.ts
- **Nulu equivalent:** packages/llm/llm-gateway/src/common/image-tokens.ts
- **Rationale:** The V4.1 token grid is DeepSeek-specific billing. Nulu uses the World App API token accounting; do NOT import the DeepSeek grid.

## Reasoning/thinking transport (reasoning_content)

- **Classification:** ALREADY-PRESENT
- **Upstream commits:** (various reasoning passback commits)
- **Upstream files:** packages/llm/llm-deepseek/src/protocols/chat-completions/{translate,sse}.ts
- **Nulu equivalent:** packages/llm/llm-gateway/src/protocols/chat-completions/* + thinkingFormat: deepseek
- **Rationale:** Nulu already speaks the reasoning wire format via thinkingFormat: deepseek. Keep it.

## Protocol unification / structural reorg (flat src/ -> src/common/)

- **Classification:** ADAPT
- **Upstream commits:** 6a137ea702 refactor(llm): unify DeepSeek protocol implementations
- **Upstream files:** packages/llm/llm-deepseek/src/{types,serialize,translate,sse}.ts (flat)
- **Nulu equivalent:** packages/llm/llm-gateway/src/{types,serialize,translate,sse}.ts -> src/common/* (already restructured)
- **Rationale:** Nulu already restructured into src/common/. Reconcile the flat re-exports with upstream additions.
