# Agent Note: In-place installation of unsigned Nulu releases

Status: implemented

## Problem

Nulu releases are unsigned previews. Their packages carry no electron-updater feed, so an installed application could only announce a newer GitHub release and open its page. Every release required each user to download and run an installer by hand, and the hourly upstream releases made that the normal path.

## Decision

A package without `app-update.yml`, and every Linux AppImage because its feed is never uploaded, installs the published release itself. `ReleaseSelfUpdater` in [apps/desktop](../../../../apps/desktop/README.md#updates) implements the three operations the update coordinator already calls, so the confirmation dialog, state publication, and backend shutdown are unchanged.

| Installation | Asset | Replacement |
|---|---|---|
| Windows x64 | NSIS installer | Run with `--updated /S --force-run`; the installer closes, replaces, and restarts the application. |
| Launched Linux AppImage | AppImage | Rename over the file named by `APPIMAGE`, then start it after the old process exits and its runtime removes `APPDIR`. |
| Writable macOS bundle | Release ZIP | Extract with `ditto`, exchange the bundle by two renames, then `open` it after the old process exits. |
| Extracted AppImage, translocated or read-only bundle, other targets | none | Keep the download notice. |

The asset must match the SHA-256 that the same release lists in `SHA256SUMS`. All failure-prone work precedes backend shutdown; a failure leaves the installation unchanged and offers the release page. The replaced macOS bundle stays beside the new one until the next check deletes it.

## Alternatives considered

- **electron-updater with a GitHub feed.** Squirrel.Mac rejects unsigned and ad-hoc-signed bundles, the two separately built macOS targets would both publish `latest-mac.yml`, and the Windows feed would require removing the configured publisher check. It needs new release metadata for a path that still excludes macOS.
- **Keep download notices until signing exists.** Signing has no date, and the manual path does not scale to hourly releases.
- **A detached signature over the checksum list.** A key held by the same repository's workflow adds no independent authority; publisher signing is the intended replacement.

## Consequences

The update is as trustworthy as the GitHub release it comes from: the checksum detects corruption and truncation, not a compromised release. Windows SmartScreen and macOS Gatekeeper still question the first manual installation. macOS privacy grants bound to the ad-hoc code hash are requested again after each update. Releases before this change must be updated by hand once.

## Verification

`apps/desktop/tests/release-self-update.spec.ts` covers target selection, checksum rejection, and the three replacements, including an actual rename and restart on POSIX hosts. `scripts/automation/self-update-e2e.mjs` performs the replacement and restart with the packaged application on Windows, macOS, and Linux runners through the self-update workflow.
