# Unit 2 — workflow-worker-thread (LOW)

- **Dependencies:** none

- **Upstream commits:** (workflow session/protocol commits)

## Upstream change
packages/workflow/workflow-worker-thread/src/{host,protocol,session,worker}.ts

**Intent:** Workflow worker session/protocol changes.

## Nulu equivalent
packages/workflow/workflow-worker-thread/src/{host,protocol,session,worker}.ts

**Current behavior:** Same path; generic workflow runtime.

## Architectural difference
None.

## Required Nulu translation
Port verbatim.

## Preserve
- Generic workflow behavior

## Do NOT import
- 

## Protected invariants
- No DeepSeek strings

## Relevant tests
- packages/workflow/workflow-worker-thread/tests/{session,buit-worker,egress}.spec.ts

## Acceptance
workflow tests pass; validate.mjs PASS.
