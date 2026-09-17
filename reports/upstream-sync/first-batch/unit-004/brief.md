# Unit 4 — e2b/e2b (MEDIUM)

- **Dependencies:** 1

- **Upstream commits:** (e2b egress/composition commits)

## Upstream change
packages/e2b/e2b/src/{api-url,index}.ts, tests/{composition,egress,e2b}.spec.ts

**Intent:** E2B sandbox API URL handling and egress controls.

## Nulu equivalent
packages/e2b/e2b/src/{api-url,index}.ts

**Current behavior:** Same package; generic sandbox API.

## Architectural difference
None.

## Required Nulu translation
Port verbatim.

## Preserve
- Generic e2b API

## Do NOT import
- 

## Protected invariants
- No DeepSeek strings

## Relevant tests
- packages/e2b/e2b/tests/{composition,egress}.spec.ts

## Acceptance
e2b tests pass; validate.mjs PASS.
