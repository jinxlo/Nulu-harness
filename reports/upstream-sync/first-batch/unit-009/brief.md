# Unit 9 — rename leftover plugin-package-inventory (HIGH)

- **Dependencies:** none

- **Upstream commits:** (inventory upstream evolution)

## Upstream change
packages/llm/plugin-package-inventory/package.json

**Intent:** DeepSeek plugin inventory continued under old name.

## Nulu equivalent
packages/llm/plugin-package-inventory (already renamed)

**Current behavior:** Already renamed to plugin-package-inventory.

## Architectural difference
Rename conflict.

## Required Nulu translation
Reject deepseek name; port generic inventory changes into plugin-package-inventory.

## Preserve
- Nulu rename

## Do NOT import
- deepseek name

## Protected invariants
- No deepseek package names

## Relevant tests
- plugin-package-inventory tests

## Acceptance
grep -riE "deepseek" packages/llm/plugin-package-inventory empty.
