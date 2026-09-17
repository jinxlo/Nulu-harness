# Unit 8 — rename leftover subagent-nulu-sdk (HIGH)

- **Dependencies:** none

- **Upstream commits:** (subagent-nulu-sdk upstream evolution)

## Upstream change
packages/subagent/subagent-nulu-sdk/package.json

**Intent:** Subagent SDK continued development under the old name.

## Nulu equivalent
packages/subagent/subagent-nulu-sdk (already renamed)

**Current behavior:** Already renamed to subagent-nulu-sdk with World App default model.

## Architectural difference
Rename conflict — the old name must not return.

## Required Nulu translation
Reject subagent-nulu-sdk; port generic SDK changes into subagent-nulu-sdk.

## Preserve
- Nulu rename
- nulu-5-ultra default model

## Do NOT import
- nulu name
- DeepSeek SDK assumptions

## Protected invariants
- No nulu/deepseek package names
- Nulu default model

## Relevant tests
- subagent-nulu-sdk tests

## Acceptance
grep -riE "nulu" packages/subagent empty; subagent-nulu-sdk builds.
