# Agent Note: Qualify automatic Nulu releases before promotion

Status: implemented

## Problem

The Nulu release history and default branch differ. Upstream sync is manual, its adapter is a placeholder, and desktop build dispatch does not qualify or promote a complete multi-platform release. The public website also needs a trustworthy source for versioned downloads.

## Decision

The [update workflow](../../../../.github/workflows/nulu-update.yml) qualifies an isolated candidate before promotion. The [automation implementation](../../../../scripts/automation/README.md) owns batching, protected files, model adaptation, version identity, real API verification, native installation tests, hosted checksum verification and release publication. A configurable trusted source ref permits baseline repairs to be tested before the application history is promoted to the default branch. Native builds and exhaustive source checks run concurrently after basic preparation; publication still requires both. Coverage uses the repository aggregate and its existing instrumentation budget.

Preparation verifies protected Nulu files after each qualification command, including dependency lifecycle scripts. Changes, removals, renames, and newly introduced protected files stop the candidate before its release checkpoint is written. A temporary Git fixture exercises those rejection paths.

The workflow preserves the current unsigned developer-preview channel. Signed installation remains dependent on explicit signing infrastructure. The [existing desktop packaging decision](../architecture/2026-08-25-electron-desktop-packaging-and-updates.md) continues to own runtime release identity and signing requirements; this note adds unattended qualification and download promotion.

The independent heartbeat recognizes a published baseline whose exact release commit remains in `main` after later maintenance commits. Divergent history, draft releases, and missing catalogs leave baseline qualification enabled. Captured persistence history and technical event identifiers retain their original bytes during branding.

## Alternatives considered

**Merge and rebrand upstream on the default branch.** This exposes incomplete adaptation and can rewrite Nulu policy or publishing controls. Candidate isolation and protected tooling preserve a working release during failures.

**Publish each platform as it completes.** This can expose different versions or missing targets. The publisher requires a complete platform set and verifies uploaded bytes before promoting the release.

**Treat a successful build as release qualification.** Compilation does not exercise installation, saved sessions, real tools or model requests. The workflow requires those observations separately.

## Consequences

Unattended compatible updates can progress through the same qualification path as manual candidates. Unsupported migrations and baseline regressions stop publication and remain visible in reports. Keeping old downloads available costs additional retained artifacts and requires an independent scheduler heartbeat. A failing application baseline can run scheduled checks but cannot publish installers.
