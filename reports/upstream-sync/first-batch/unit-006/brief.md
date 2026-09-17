# Unit 6 — client/connection (MEDIUM)

- **Dependencies:** none

- **Upstream commits:** (connection fixture commits)

## Upstream change
packages/client/connection/src/client/fixture.ts, tests/fixture.client.spec.ts

**Intent:** Connection fixture shape changes.

## Nulu equivalent
packages/client/connection/src/client/fixture.ts

**Current behavior:** Same path; must not alter World App provider contract.

## Architectural difference
None.

## Required Nulu translation
Port; verify the worldapp route is unchanged.

## Preserve
- World App connection contract (baseURL, apiKey)

## Do NOT import
- 

## Protected invariants
- provider abstraction
- World App base URL/key

## Relevant tests
- packages/client/connection/tests/fixture.client.spec.ts

## Acceptance
connection tests pass; worldapp route unchanged.
