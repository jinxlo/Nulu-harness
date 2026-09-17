# Unit 1 — e2b/subprocess-e2b (LOW)

- **Dependencies:** none

- **Upstream commits:** (subprocess-e2b hardening commits)

## Upstream change
packages/e2b/subprocess-e2b/src/{environment,process,terminal,remote,output}.ts

**Intent:** Subprocess sandbox lifecycle and terminal output streaming.

## Nulu equivalent
packages/e2b/subprocess-e2b/src/{environment,process,terminal,remote,output}.ts

**Current behavior:** Same package/path; no provider coupling.

## Architectural difference
None — generic sandboxing.

## Required Nulu translation
Port verbatim.

## Preserve
- Generic subprocess behavior

## Do NOT import
- No DeepSeek/provider assumptions

## Protected invariants
- No DeepSeek strings

## Relevant tests
- packages/e2b/subprocess-e2b/tests/subprocess.spec.ts
- terminal.spec.ts

## Acceptance
subprocess-e2b tests pass; validate.mjs PASS.
