# Unit 8 — rename leftover subagent-dsh-sdk (HIGH)

- **Dependencies:** none

- **Upstream commits:** (subagent-dsh-sdk upstream evolution)

## Upstream change
packages/subagent/subagent-dsh-sdk/package.json

**Intent:** Subagent SDK continued development under the old name.

## Nulu equivalent
packages/subagent/subagent-nulu-sdk (already renamed)

**Current behavior:** Already renamed to subagent-nulu-sdk with World App default model.

## Architectural difference
Rename conflict — the old name must not return.

## Required Nulu translation
Reject subagent-dsh-sdk; port generic SDK changes into subagent-nulu-sdk.

## Preserve
- Nulu rename
- nulu-5-ultra default model

## Do NOT import
- dsh name
- DeepSeek SDK assumptions

## Protected invariants
- No dsh/deepseek package names
- Nulu default model

## Relevant tests
- subagent-nulu-sdk tests

## Acceptance
grep -riE "dsh" packages/subagent empty; subagent-nulu-sdk builds.
