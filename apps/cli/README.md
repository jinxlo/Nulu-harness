# `@worldapptechnologies/nulu`


The `dsh` command is the sole supported Node application launcher: profiles are ordered stacks of plugin-bundle patch layers under the user's own overrides. SDK and ACP are profiles, not separate public bins. The Python runtime wheel packages this same command; the SDK defaults to `sdk`, and the minimal example selects `sdk-minimal`. [`src/args.ts`](src/args.ts) owns the command grammar, and [`src/bin.ts`](src/bin.ts) loads only the selected runner. Invalid commands, options from another mode, and fatal configuration or boot failures exit nonzero.

## Entry modes

| Command | Purpose |
|---|---|
| `nulu --profile <name>` | Boot the named profile under `$NULU_HOME/profiles/<name>`. |
| `nulu --profile <name> --from-default-profile <template>` | Create a new custom profile from a shipped template, then boot it. |
| `nulu --profile acp` | Serve automation clients over ACP stdio until disconnect. |
| `nulu --profile headless "job"` | Run one fresh persisted session, print the final answer, and exit. |
| `nulu --profile sdk` | Serve SDK clients over JSON-RPC stdio until shutdown or disconnect. |
| `nulu --profile sdk-minimal` | Serve SDK clients with the standalone minimal agent tree. |
| `nulu web` | Alias of `--profile web`. |
| `nulu plugin --profile <name> <pnpm args>` | Manage a profile's plugins by forwarding to pnpm in the profile directory. |

The invoking directory is the default workspace root. The `web`, `headless`, `sdk`, `sdk-minimal`, and `acp` profiles auto-initialize on first use from shipped templates. Create another profile at an unused, non-shipped name with `--from-default-profile`, or initialize a base-backed profile through `nulu plugin`. The `desktop` name is reserved for the Electron-owned profile, so the CLI rejects boot, config-dump, and plugin-management requests for it.

## App arguments

The launcher parses only its own flags and hands everything after them to the booted profile, where any injected app plugin may parse the shared immutable snapshot ([`nulu-cmdline`](../../packages/boot/cmdline/README.md)). The first token the launcher does not recognize starts the app's arguments:

```sh
nulu --profile web --port 8080       # --port belongs to the web app
nulu --profile tui --resume <id>     # example, assuming the tui profile is installed; --resume belongs to the terminal app
nulu --profile headless "run the tests"
nulu --profile web --help            # the web app's flags, not the launcher's
nulu --help                          # the launcher's own help
```

<a id="profiles"></a>
## Profiles

A profile directory holds a `package.json` (out-of-tree plugin dependencies plus the profile manifest `nulu.profile` with its ordered `bundles` list and `patchReload` lifecycle) and a `cordis.patch.yml` (the user's own patch layer). `patchReload: live` watches the profile and home-level patch files; `startup` applies them once.

The tree composes over an empty root:
- each bundle's patch in `nulu.profile.bundles` order
- then the profile's `cordis.patch.yml`, then the home-level `$NULU_HOME/cordis.patch.yml`
- then `--patch` overlays

Bundles named in `nulu.profile.bundles` resolve from the nulu installation first (`@worldapptechnologies/nulu-base`, `@worldapptechnologies/nulu-web-app`, `@worldapptechnologies/nulu-headless`, `@worldapptechnologies/nulu-sdk-app`, `@worldapptechnologies/nulu-sdk-minimal`, `@worldapptechnologies/nulu-acp-app`), then from the profile's own `node_modules`, where pnpm installs out-of-tree plugins.

Use `--dump-default-config` and `--dump-config` to inspect the composed tree without booting it.

The [CLI behavior reference](reference/README.md) owns exact layer precedence, flags, shutdown behavior, deployment defaults, and source execution. The [startup and reload failure table](../../packages/boot/app-boot/README.md#startup-and-reload-failures) compares optional and required plugin failures with configuration HMR.

## Optional overlays

`config/examples/` ships opt-in overlays for GitHub review webhooks, session-local Schedule, memory MCP servers, and runtime Cordis tools. They are never part of a default profile; the [user guides](../../docs/user/guide/index.md) and [developer practice guides](../../docs/user/develop/practice/index.md) own setup and safety instructions.

## Development

Production runs require built package and frontend artifacts. From the repository root, run `pnpm run build` separately, then use `pnpm dsh <args...>` to run the TypeScript entry and forward every argument; the [source-execution reference](reference/README.md#source-execution) owns the module-resolution contract.

The [Web failure matrix](tests/profiles/web/tests/web-failure-matrix.expected.e2e.ts) runs the built CLI through startup failures and native configuration HMR with `awaitWriteFinish` enabled in `test:expected`. It verifies authenticated HTTP responses, diagnostics, recovery, process exits, and disposal without model API calls; the [startup acceptance](tests/profiles/web/tests/web-best-effort-startup.expected.e2e.ts) also covers the shipped required Web dependencies and port conflicts.
