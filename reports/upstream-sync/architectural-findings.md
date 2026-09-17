# Upstream 0.1.6 architectural findings

The upstream (c291e7961a51 → 0d1f50007f9b) is NOT a simple bug-fix release. It is a
major restructuring. The "100 semantic conflicts" decompose into three kinds of
work, and most are architectural decisions, not mechanical ports.

## Removed / retired upstream

| Removed | Upstream replacement | Nulu decision |
|---|---|---|
| `packages/e2b/*` (e2b, fs-e2b, subprocess-e2b) | `packages/sandbox`, `packages/ssh`, `packages/subprocess`, `packages/terminal`, `packages/computer-use` | Retire E2B like upstream, or keep Nulu's e2b? |
| `packages/workflow/workflow-worker-thread` | (removed, no direct replacement) | Remove, or keep? |
| `packages/code-runtime/code-runtime-node` | (removed) | Remove, or keep? |
| `packages/llm/llm-deepseek-messages` | consolidated INTO `llm-deepseek/src/protocols/messages` | Absorb into `llm-gateway` (already partially done) |
| `packages/llm/llm-image-offload` | consolidated INTO `llm-deepseek` + llm-retry | Absorb into `llm-gateway` |
| `packages/interaction/auto-review` | (removed) | Remove, or keep? |
| `packages/experimental/browser-use-stagehand-native` | `packages/browser-use` (rewritten) | Adopt new browser-use, or keep? |

## Added upstream (new capabilities)

- `packages/browser-use` — browser automation agent
- `packages/computer-use` — computer automation
- `packages/ssh` — SSH remote runtime
- `packages/ptc-runtime` — new runtime
- `packages/terminal` — terminal controller
- `packages/sandbox` — consolidated sandbox (local/policy/windows-acl)
- many `client/ui-*` packages (unarchive-sessions, sidebar-documentpreview, permission-presets, …)

## The llm-deepseek → llm-gateway core

Upstream consolidated the Messages protocol and image offload INTO `llm-deepseek`.
Nulu renamed `llm-deepseek` → `llm-gateway` and swapped the DeepSeek provider for
World App Technologies. The 46 `llm-gateway` conflicts are the port of that
consolidation into the Nulu gateway — genuine capability work, not file merges.

## Decisions required before meaningful adaptation

1. **E2B retirement** — follow upstream (adopt sandbox/ssh/subprocess/terminal) or keep Nulu e2b?
2. **New runtimes** — adopt browser-use / computer-use / ssh / ptc-runtime?
3. **workflow + code-runtime-node removal** — follow upstream?
4. **llm consolidation** — absorb Messages + image-offload into llm-gateway (recommended; matches Nulu's existing Messages protocol)?

Until these are decided, mechanically resolving the remaining conflicts would
either delete Nulu functionality or reintroduce retired upstream code.
