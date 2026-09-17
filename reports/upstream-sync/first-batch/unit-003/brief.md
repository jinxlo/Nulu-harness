# Unit 3 — code-runtime-worker-thread (LOW)

- **Dependencies:** none

- **Upstream commits:** (code-runtime budget commits)

## Upstream change
packages/code-runtime/code-runtime-worker-thread/src/{index,worker}.ts

**Intent:** Code-runtime worker budget/runtime changes.

## Nulu equivalent
packages/code-runtime/code-runtime-worker-thread/src/{index,worker}.ts

**Current behavior:** Same path; generic code sandbox.

## Architectural difference
None.

## Required Nulu translation
Port verbatim.

## Preserve
- Generic code-runtime behavior

## Do NOT import
- 

## Protected invariants
- No DeepSeek strings

## Relevant tests
- packages/code-runtime/code-runtime-worker-thread/tests/{budget,runtime}.spec.ts

## Acceptance
code-runtime tests pass; validate.mjs PASS.
