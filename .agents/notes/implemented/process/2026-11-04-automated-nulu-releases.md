# Agent Note: Qualify automatic Nulu releases before promotion

Status: implemented

## Problem

The Nulu release history and default branch differ. Upstream sync is manual, its adapter is a placeholder, and desktop build dispatch does not qualify or promote a complete multi-platform release. The public website also needs a trustworthy source for versioned downloads.

## Decision

The [update workflow](../../../../.github/workflows/nulu-update.yml) qualifies an isolated candidate before promotion. The [automation implementation](../../../../scripts/automation/README.md) owns batching, protected files, model adaptation, version identity, real API verification, native installation tests, hosted checksum verification and release publication. A configurable trusted source ref permits baseline repairs to be tested before the application history is promoted to the default branch.

Preparation verifies protected Nulu files after each qualification command, including dependency lifecycle scripts. Changes, removals, renames, and newly introduced protected files stop the candidate before its release checkpoint is written. A temporary Git fixture exercises those rejection paths.

Qualification tests both the direct gateway and the shipped CLI against the public Nulu API. The direct gateway defaults to Chat Completions at the public endpoint; Messages requires an explicit compatible endpoint because the public Messages route returns HTTP 404. This overrides only the upstream [Messages adapter decision](../feature/2026-09-07-deepseek-messages-adapter.md) on default protocol and endpoint; its replay and transport design remains active. The base bundle also supplies the Node PTC runtime required by its workflow engine, preventing inactive workflow tools.

The workflow preserves the current unsigned developer-preview channel. Signed installation remains dependent on explicit signing infrastructure. The [existing desktop packaging decision](../architecture/2026-08-25-electron-desktop-packaging-and-updates.md) continues to own runtime release identity and signing requirements; this note adds unattended qualification and download promotion.

The baseline restores the archive manifest from trusted `main` seals and retains the three additional artifacts whose existing seals match their bytes. All 628 main artifacts already match their trusted hashes, and no archived artifact changes. The older merge incorrectly labeled a stale bilingual manifest as version 2. Verification compares this reconciliation against `origin/main`, the actual promotion base, rather than treating the corrupt intermediate manifest as a new sealing authority.

The recovered archive retains three version-1 artifacts with their original sealed bytes. Only those exact checksums admit their historical header and translation metadata; changed content and other legacy filenames still fail. Compiler-generated declarations accidentally committed beside 15 TypeScript source owners are removed; ordinary builds emit declarations under `lib/types`.

The SDK mounts the actual `worldapp-gateway` route. Its transport fixtures use the public Chat Completions protocol. Historical delivery and search event names remain read-compatible, while new Nulu requests and receipts retain the Nulu event names and endpoint. The schema-v1 hashing namespace remains its original technical identifier; branding never rewrites that identifier or captured persistence history.

The independent heartbeat recognizes a published baseline whose exact release commit remains in `main` after later maintenance commits. Divergent history, draft releases, and missing catalogs leave baseline qualification enabled. Captured persistence history and technical event identifiers retain their original bytes during branding.

## Alternatives considered

**Merge and rebrand upstream on the default branch.** This exposes incomplete adaptation and can rewrite Nulu policy or publishing controls. Candidate isolation and protected tooling preserve a working release during failures.

**Publish each platform as it completes.** This can expose different versions or missing targets. The publisher requires a complete platform set and verifies uploaded bytes before promoting the release.

**Treat a successful build as release qualification.** Compilation does not exercise installation, saved sessions, real tools or model requests. The workflow requires those observations separately.

## Consequences

Unattended compatible updates can progress through the same qualification path as manual candidates. Unsupported migrations and baseline regressions stop publication and remain visible in reports. Keeping old downloads available costs additional retained artifacts and requires an independent scheduler heartbeat. A failing application baseline can run scheduled checks but cannot publish installers.
