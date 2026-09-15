# Agent Note: Bundle the host native platform package in the desktop payload

Status: implemented


## Problem

The [prebuilt system primitives](2026-09-07-prebuilt-system-primitives.md) replaced the compiled `fs-ext` dependency with `@worldapptechnologies/node-addon-system`: the `flock` addon carries the POSIX Session write lease and `landlock-run` carries the Desktop sandbox launcher. Both resolve their binaries from the per-platform package `@worldapptechnologies/node-addon-system-<os>-<cpu>` beside the entry package.

Desktop packaging packed only the entry package into the Landlock tarball directory and never built or packed a platform package, and the npm registry carries no `@worldapptechnologies` platform packages. A prepared payload therefore omitted `bin/landlock-run` and `bin/glibc/system.node`; session writes on Linux and macOS failed with `MODULE_NOT_FOUND`. The payload smoke fixture still required the removed `fs-ext` package at the same time, so the Linux installer build stopped before electron-builder.

## Decision

`apps/desktop/scripts/package-target.ts` builds the full host native payload (`pnpm --dir native/system run build:native`) and packs the host platform package into the target's Landlock tarball directory before packing the entry package whenever the target declares a platform package. The platform package must match the packaging host; a target that cannot build its native payload on the current host fails before packaging rather than shipping a payload without its binding. `apps/desktop/scripts/prepare-package-set.ts` selects the platform tarball into the desktop package closure like any other optional dependency, and the runtime copy filter lets its `bin/` files through.

The payload smoke fixture checks the flock binding instead of `fs-ext`: it acquires the lock, verifies a second descriptor is rejected with `EAGAIN`/`EWOULDBLOCK`, and on Windows verifies the unsupported-platform rejection instead because Windows locks through Koffi. `.github/workflows/desktop-build.yml` installs `musl-tools` on the Linux lane, mirroring the native workspace workflow, because the platform payload includes the static-musl Landlock launcher and the musl addon.

## Alternatives considered

**Resolve the platform package from the npm registry at payload preparation.** The registry publishes the family under the upstream `@worldapptechnologies` scope, not `@worldapptechnologies`, so payload preparation would fail on every platform. Depending on the registry would also break offline and pinned builds.

**Copy the platform binaries into the entry package tarball.** The entry package keeps binaries in a replaceable platform package; copying binaries into the entry tarball would create a second distribution shape for the same bytes and diverge from the native release artifacts.

**Restore `fs-ext` for the payload smoke.** No manifest declares the dependency; the smoke must exercise the shipped binding, and the stale fixture was exactly what hid the missing platform package.

**Cross-build the platform package when an Apple Silicon host targets Intel macOS.** `native/system/scripts/build.ts` builds only the host payload. The Rosetta development path now stops with an explicit message instead of producing a payload whose addon cannot load under the x64 runtime.

## Consequences

- Desktop payloads contain the same launcher and addon bytes the native release publishes, so Linux and macOS sessions lock and sandbox without registry access.
- The Linux packaging lane and local Linux builds need `musl-tools`; the native payload build adds seconds to each desktop package command.
- Intel macOS packaging from an Apple Silicon host is rejected; the CI matrix builds that target on `macos-15-intel`.
- Windows desktop payloads keep the entry package and skip the platform package, matching the family's Windows support (Koffi lock, no Landlock launcher).
