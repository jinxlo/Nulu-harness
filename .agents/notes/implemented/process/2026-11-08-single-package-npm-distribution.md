# Agent Note: nulu-harness ships as one npm package

Status: implemented

## Problem

`npm install -g nulu-harness` installed a small launcher package that depended on `@worldapptechnologies/nulu`, which pulled in the rest of the release family: 287 `@worldapptechnologies/nulu-*` packages, each published separately. npm limits how many new packages one account may create in a period. The first publication of 1.6.4 stopped after 11 packages, and the hourly resumes reached 36 in two days. Every later version repeats all 287 publications, because npm never replaces a published version.

## Decision

[`pack-distribution.mjs`](../../../../scripts/automation/pack-distribution.mjs) unpacks every family tarball into `runtime/node_modules/<name>` inside the nulu-harness package and lists the external dependencies of the family in the package's `dependencies`. One `npm publish` of nulu-harness releases a version. Node resolves a family package's imports in `runtime/node_modules` first, then in the `node_modules` directory npm installs above it, so the family's code runs unchanged. The `nulu` command resolves `@worldapptechnologies/nulu` from `runtime/`.

External dependencies stay ordinary npm dependencies because several of them install a different build per operating system and processor (`sharp`, `node-pty`, `koffi`, `@vscode/ripgrep`, `@openai/codex`). The top-level range for a dependency is the major line most family packages ask for, at its highest floor, preferring an exact version at an equal floor. A family package whose range that version does not satisfy gets its own copy in its `node_modules`, installed without peers so it still reaches the single top-level copy of `@worldapptechnologies/cordis`. The packer refuses a nested copy that holds an `os` or `cpu` restriction, an install script, `binding.gyp`, or a `.node` file, and refuses family optional dependencies, because the tarball is packed on Linux.

[`cli-install-check.mjs`](../../../../scripts/automation/cli-install-check.mjs) publishes only the nulu-harness tarball to its throwaway registry, which does not proxy `@worldapptechnologies/nulu*` names, so an installation that still needed a separately published family package fails the check.

## Alternatives considered

- **`bundleDependencies`.** npm bundles every package reachable from a bundled dependency, including external ones that are also top-level dependencies. The packed 1.6.4 tarball was 330 MB and carried Linux builds of the native dependencies.
- **One bundled JavaScript file.** Cordis loads plugins by package name from `cordis.yml`; flattening the family into one file would change how the product loads its plugins.
- **Waiting out the npm limit.** Each version would take days to reach npm.

## Consequences

A version is one npm publication of about 11 MB. The `@worldapptechnologies/nulu-*` packages already on npm from the 1.6.4 attempt are unused. The `release:publish --family nulu` path in `scripts/release/` stays available for the vendored families, which publish separately.
