# Upstream

Nulu Harness is a fork of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), maintained by World App Technologies. This page records the sync baseline, the fork's identity changes, and the procedure for merging upstream work.

## Baseline

| Fact | Value |
|------|-------|
| Upstream repository | `https://github.com/deepseek-ai/deepseek-harness` |
| Baseline commit | `c291e7961a515f6d7af9304e7fd1d257929aef26` (`master`) |
| Baseline version | `0.1.5-rc.2` |
| Fork repository | `https://github.com/worldapptechnologies/nulu-harness` |
| Fork branch | `nulu/v1` |

The upstream license is MIT. [`LICENSE`](LICENSE) keeps the upstream copyright notice, and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) is generated, never hand-edited.

## What the fork changes

- Product identity: display names, metadata, UI copy, artwork, package names, the `nulu` CLI, the `NULU_*` environment prefix, and the `~/.nulu` home directory. `scripts/rebrand/rebrand.mjs` applies these rules and is idempotent.
- Default provider: the `worldapp` (World App Technologies) route with the `nulu-5-ultra` model ships as the composition default; see `packages/bundle/base/cordis.patch.yml`.
- Development happens only in this repository; no commits are written back upstream.

## What the fork keeps

- The DeepSeek provider surfaces stay intact and are documented as third-party providers: `packages/llm/llm-deepseek/`, `packages/web/web-search-deepseek/`, the `deepseek-official` route, `api.deepseek.com`, and `DEEPSEEK_API_KEY`.
- Archived Agent Notes and other historical records keep their original wording.

## Toolchain

Node.js 24 is the primary version (`package.json` allows `^22.19.0 || >=24.0.0`). CI and the web snapshot lane run Node 24. pnpm comes from the `packageManager` field through Corepack.

## Sync procedure

```sh
git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git   # once
git fetch upstream
git switch nulu/v1
git merge upstream/master
```

Resolve conflicts by preserving the fork's identity changes, then:

```sh
pnpm exec tsx scripts/rebrand/rebrand.mjs   # re-apply identity rules to upstream additions
pnpm install
pnpm run build
```

Regenerate derived artifacts and re-record the bilingual pairs the merge touched:

```sh
pnpm run gen-config-catalog
pnpm run gen-module-graph
pnpm run gen-doc-graphs
pnpm run gen-tsconfig-paths
pnpm run gen-client-catalog
pnpm run gen-cordis-catalog
pnpm run gen-cordis-api
pnpm run gen-cordis-inspect-catalog
pnpm run gen-tool-catalog
pnpm run gen-persistence-catalog
pnpm run gen-session-format-catalog
pnpm run gen-third-party-notices
pnpm exec tsx scripts/verify-translation-pairing.ts --write --all
```

Finish with the repository gates:

```sh
pnpm run typecheck
pnpm run test
pnpm run verify-translation-pairing
```

Web snapshot expectations follow behavior the merge intentionally changes; re-record them only through the snapshot procedures in [`docs/testing.md`](docs/testing.md).
