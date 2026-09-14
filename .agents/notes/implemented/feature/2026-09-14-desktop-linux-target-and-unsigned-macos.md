# Agent Note: Add the Linux x64 desktop release target and unsigned macOS test lanes

Status: implemented

English | [中文](2026-09-14-desktop-linux-target-and-unsigned-macos.zh.md)

## Problem

The desktop release matrix had macOS arm64/x64 and Windows x64 lanes only. Linux users had no installable desktop artifact, CI produced no installers without production signing credentials, and the only unsigned lane covered Windows, so macOS and Windows test installs required locally assembled packages.

## Decision

Linux x64 is a supported desktop release target. `package:desktop:linux:x64` packages the AppImage from `apps/desktop/electron-builder.config.mjs` on a Linux x64 host. The target joins the update environment vocabulary (`linux-x64` in `apps/desktop/scripts/desktop-auto-update-environment.mjs`), and channel metadata resolves to `latest-linux.yml` or the prerelease `<channel>-linux.yml`. Linux artifacts ship as GitHub release assets instead of the COS upload: `apps/desktop/scripts/desktop-upload-plan.ts` keeps the validated upload plan for the signed macOS and Windows channels, since the AppImage carries no platform signing step and the upload plan requires signed artifacts. electron-builder derives the AppImage executable name from the package name, so `apps/desktop/electron-builder.config.mjs` pins `linux.executableName` to `nulu-harness` instead of the scoped `@worldapptechnologies/nulu-desktop`.

`--unsigned` package invocations support macOS and Windows. A macOS unsigned package strips the Developer ID identity, notarization, and release completion record through the same scrubbed environment as Windows, and isolates outputs in the target's `unsigned-artifacts` directory. `package-target.ts` rejects `--unsigned` for Linux because Linux packaging has no signing input to remove, and its error names the accepted platforms. The regular package command selects signed mode explicitly even when its parent requests unsigned mode, so unsigned output cannot qualify for release upload.

`.github/workflows/desktop-build.yml` packages the matrix on manual dispatch: `ubuntu-24.04` runs the regular linux-x64 command, while `macos-15` (mac-arm64), `macos-15-intel` (mac-x64), and `windows-2025` (win-x64) run unsigned commands. Each lane uploads its artifact directory (`artifacts` or `unsigned-artifacts`) as a workflow artifact. An optional release job runs only when `publish_release` is set, requires `release_tag`, downloads every lane's artifacts, and creates a draft GitHub release through `gh release create --draft --generate-notes`; the job never promotes the draft to a public release.

This supersedes the initial-platform decision and the Windows-only unsigned scope in [the packaging note](../architecture/2026-08-25-electron-desktop-packaging-and-updates.md). Signing, notarization, update hosting, and release identity stay owned there.

## Alternatives considered

**Sign and notarize Linux artifacts.** The AppImage release flow has no Linux signing identity or notarization step, and the COS upload plan requires signed artifacts. Linux publishes through GitHub Releases instead of weakening that validation.

**Extend the COS upload plan to an unsigned target.** The plan validates signed update payloads and channel metadata before replacing the previous channel. Accepting an unsigned target would either drop that validation or invent a Linux signing step the release environment does not have.

**Build macOS or Windows from the Linux runner.** Native dependencies and electron-builder require the target host, and Developer ID and EV token access stay on their own runners.

**Keep macOS unsigned local-only, as Windows was before this change.** Verifying installable macOS test packages requires a lane that runs in CI without Developer ID, which a local-only command cannot provide.

**Require signing credentials in CI.** The test lanes exist before signing infrastructure does; unsigned installers exercise the same build and runtime preparation without certificates and stay ineligible for upload.

## Consequences

- Linux x64 desktop users install an AppImage from the GitHub release; no Linux package feeds the update upload.
- CI produces macOS and Windows test installers without Developer ID or EV credentials, and signed production lanes keep their credential requirements.
- Unsigned artifacts remain isolated under `unsigned-artifacts` and omitted from update configuration and release completion records.
- The release job creates drafts only; publishing remains a separate, explicit action.
- Update metadata filenames cover the new target, so a later Linux update channel needs no new naming work.
