# Agent Note: One harness home resolver

Status: implemented

English | [中文](2026-07-24-single-harness-home-resolver.zh.md)

## Problem

The harness had two inconsistent conventions for "where does Nulu Harness user data live":

- `@worldapptechnologies/nulu-home` resolved `configured ?? $NULU_HOME ?? ~/.nulu`.
- `@worldapptechnologies/nulu-home-paths` shipped a **second** `resolveDshHome` with the same precedence plus tilde expansion — a near-duplicate of `nulu-home` that no gate flagged because the two lived in different packages and had already drifted (only one expanded tildes).

Two resolvers for the same cross-cutting fact meant there was no single home policy.

## Decision

One resolver owns the harness home, in `@worldapptechnologies/nulu-home-paths`, single-root:

```
explicit configured path  >  $NULU_HOME  >  ~/.nulu
```

An empty or whitespace-only `$NULU_HOME` is treated as unset; otherwise `resolve('')` would silently place the home at the current working directory. The harness keeps all user data under one root; there is no XDG config/data/cache split. `nuluHomePath(...segments)` joins deployment-owned children onto that root, and `nulu-app-boot` exposes it to Loader `!!js` config expressions before mounting entries, so shipped compositions derive `sessions` and `storages` without copying the resolver. `nuluHomeDisplay()` names a resolved root symbolically for user-facing paths — `~/.nulu` for the default home, `$NULU_HOME` for any configured home — so the user-global `AGENTS.md` label never leaks an absolute machine path. It replaces agent-instructions's bespoke default-vs-`$NULU_HOME` check.

`nuluCachePath(...segments)` derives paths below the resolved home's `cache` directory. An initial `{ nuluHome }` option preserves a provider's explicit home override. It resolves paths without creating directories; callers own directory creation. `attachment-local` uses this helper for regenerable request-image variants while retaining durable attachment objects in their versioned storage tree, so clearing the cache cannot remove Session attachments. Existing request-image cache entries are left in place and are not read or copied; a cache miss regenerates the variant from its durable attachment.

`@worldapptechnologies/nulu-home` is deleted. Home-owning providers and boot packages import `resolveDshHome` from `nulu-home-paths`; composition bundles contain only the resolved configuration rows.

`nulu-telemetry` and its separate home policy are absent under the [SDK project toolchain removal](../../archived/simplification/2026-08-11-remove-sdk-project-toolchain.md), leaving this resolver as the sole home policy.

## Alternatives considered

**Leave the two `resolveDshHome` copies in place.** They had already drifted (one expands tildes, one didn't) and encode the same cross-cutting fact twice. Consolidation is the point of the `util/` layer; a duplicate resolver is a latent divergence bug.

**Adopt XDG (honor `$XDG_CONFIG_HOME`, or split config/data/cache into separate trees).** Considered and dropped in favor of one obvious root. A single `$NULU_HOME || ~/.nulu` ground truth matches `~/.claude` / `~/.aws`, needs no per-kind reclassification of every `~/.nulu` consumer, and leaves no resolver asymmetry to reconcile.

## Consequences

- One home fact, one resolver. `nulu-home-paths` is the sole owner; the `util/` group loses the `home` package.
