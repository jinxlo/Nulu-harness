# Automatic Nulu updates

The [update workflow](../../.github/workflows/nulu-update.yml) prepares isolated candidates, qualifies the exact source commit, tests every native installer, and publishes a complete release catalog. Failed candidates leave the public downloads unchanged.

## Operation

The hourly schedule and manual dispatch use `NULU_AUTOMATION_SOURCE_REF`, defaulting to `main`, as the trusted tooling checkout. Preparation first incorporates the current `main`, then imports at most ten upstream first-parent changes within an 800 KB diff budget. The coding worker receives the upstream diff and Nulu behavior manifest. It cannot execute commands, edit tests or credentials, follow symlinks, change release tooling or policy, or replace the Nulu brand package. Unfinished adaptation, forbidden writes, unresolved conflicts, and failing validation stop the candidate. Preparation also verifies protected files after each dependency, build, and test step; lifecycle scripts cannot change release controls before the candidate is committed.

`NULU_NEEDS_BASELINE=true` selects a baseline candidate without importing upstream. Clear it only after the existing application passes qualification. Root, application and package versions advance together. The integrated upstream checkpoint stays on the candidate until every required check passes and that candidate reaches `main`.

`WORLD_APP_TECHNOLOGIES_API_KEY_EXTERNAL` supplies the worker and mandatory live API smoke. The key is absent from dependency installation, builds and publishing. The smoke exercises public model discovery, actual inference, streamed file-writing tools, and saved-session resume through the built CLI. Skipping these checks cannot qualify a release.

The native matrix tests Windows x64, macOS ARM64, macOS x64, and Linux x64. It extracts or installs both the current public installer and the candidate, opens the packaged UI with isolated application and browser profiles, rejects JavaScript errors, checks version and branding, and verifies retained browser state across upgrade and restart. Each result records the candidate SHA. Publication requires all four records, all four installers, both macOS update ZIPs, and matching hosted checksums.

The release channel remains an explicitly unsigned developer preview. GitHub release notifications lead to downloads. Signed unattended installation requires separately configured Windows signing and Apple Developer ID/notarization; this workflow does not present unsigned packages as signed updates.

The publisher stages a draft release, downloads and verifies its bytes, rejects concurrent changes to `main`, advances the qualified commit, and promotes the release. Published assets are immutable. The website reads `nulu-release.json` and retains its existing complete download list if the catalog is invalid or unavailable.

## Failure recovery

Reports are retained as Actions artifacts for 30 days. Native screenshots and upgrade evidence accompany each target. A blocked migration, missing dependency, failed platform, or checksum mismatch requires repair of that candidate; never remove a required check to publish it.

If publication fails after the `main` update, rerun the failed publish job against its original candidate. Draft upload is idempotent; the publisher refuses to overwrite a public release. Withdraw a bad public release by selecting a previously qualified release for downloads. Installed session data must not be downgraded automatically.

The independent server [watchdog](watchdog.mjs) checks for missed hourly runs and dispatches a replacement after two hours without a completed check. It records its observation locally and reports a stuck run after four hours.

## Validation

The focused command is `node --test scripts/automation/automation.test.mjs`. It includes negative cases for foreign model IDs, endpoint changes, protected file writes, missing Mac ZIPs, partial or duplicate platform lists, foreign URLs, and invalid hashes. The broader repository and native checks remain required by the workflow.
