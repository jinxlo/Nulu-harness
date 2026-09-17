# Get started with the Python SDK


This tutorial installs the published Python SDK, runs the shipped standalone minimal profile, and shows how to customize the same `nulu` profile from your own program.

## Prerequisites

- Python 3.10 or newer
- Git
- Linux x64, Linux arm64, macOS 14 or newer on arm64, or Windows x64
- A Nulu-compatible API endpoint and credential
- An isolated workspace and an isolated Harness home

## Install the SDK

### Linux and macOS

```sh
git clone https://github.com/worldapptechnologies/nulu-harness.git
cd nulu-harness
python -m venv .venv
. .venv/bin/activate
python -m pip install nulu-harness-sdk
```

### Windows PowerShell

```powershell
git clone https://github.com/worldapptechnologies/nulu-harness.git
Set-Location nulu-harness
py -3.10 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install nulu-harness-sdk
```

The installation includes a matching native runtime wheel and the `nulu` command. Normal SDK execution needs no system Node.js. Repository contributors who build the artifacts should use the [Python contributor workflow](../../../python/development.md).

## Run the checked-in example

Export the credential and, when needed, a compatible proxy endpoint:

### Linux and macOS

```sh
export WORLD_APP_TECHNOLOGIES_API_KEY=sk-your-key-here
# export WORLD_APP_TECHNOLOGIES_BASE_URL=http://127.0.0.1:8000/v1
```

### Windows PowerShell

```powershell
$env:WORLD_APP_TECHNOLOGIES_API_KEY = "sk-your-key-here"
# $env:WORLD_APP_TECHNOLOGIES_BASE_URL = "http://127.0.0.1:8000/v1"
```

Run one task with explicit workspace and home paths:

### Linux and macOS

```sh
python python/sdk/examples/minimal.py \
  --workspace /absolute/path/to/disposable-workspace \
  --nulu-home /absolute/path/to/example-nulu-home \
  --session-id example-001 \
  "Inspect the repository and fix the failing tests."
```

### Windows PowerShell

```powershell
python python/sdk/examples/minimal.py `
  --workspace C:\work\disposable-workspace `
  --nulu-home C:\work\example-nulu-home `
  --session-id example-001 `
  "Inspect the repository and fix the failing tests."
```

The script prints the final assistant response. The selected home receives the generated `sdk-minimal` profile, installed plugins, and uncompressed JSONL session logs under `sessions/`. The example and SDK never silently read `~/.nulu`.

## Use the SDK in your program

```python
from pathlib import Path

from nulu_harness import NuluHarness

workspace = Path("/absolute/path/to/disposable-workspace").resolve()
nulu_home = Path("/absolute/path/to/example-nulu-home").resolve()
with NuluHarness(
    provider="worldapp-gateway",
    model="nulu-5",
    max_tokens=49_152,
    cwd=str(workspace),
    nulu_home=str(nulu_home),
    profile="sdk-minimal",
) as harness:
    result = harness.run(
        "Inspect the repository and fix the failing tests.",
        session_id="example-001",
    )

print(result.final_response)
```

The SDK starts the bundled `nulu --profile sdk-minimal` process lazily and reuses it until context-manager exit. The profile, its persistent patch, the home patch, and any ordered `patches` tuple form the application configuration. There is no separate Python runtime bin or complete-config option.

## Install or define plugins

Use `nulu plugin` for dependencies and bundle layers that should persist in this home:

### Linux and macOS

```sh
export NULU_HOME=/absolute/path/to/example-nulu-home
nulu --profile sdk-minimal --dump-default-config >/dev/null
nulu plugin --profile sdk-minimal add file:/absolute/path/to/my-plugin-bundle
```

### Windows PowerShell

```powershell
$env:NULU_HOME = "C:\work\example-nulu-home"
nulu --profile sdk-minimal --dump-default-config | Out-Null
nulu plugin --profile sdk-minimal add file:C:/work/my-plugin-bundle
```

The first command initializes the shipped standalone profile. The second forwards package management to `pnpm`, then records any installed package that exports a `nulu.bundle` layer. Install `pnpm` only for this management command; launching the installed SDK does not need it. Edit `$NULU_HOME/profiles/sdk-minimal/cordis.patch.yml` for persistent row changes, or pass patch files from Python for per-launch changes.

Another `profile` is valid when it includes `@worldapptechnologies/nulu-sdk-app` or another JSON-RPC server row. Missing server rows, unresolved plugins, and invalid patches fail during startup instead of falling back to another composition.

<a id="opt-in-to-str_replace_editor"></a>
### Opt in to `str_replace_editor`

The bundled runtime includes `str_replace_editor`, but `sdk-minimal` omits it from the default Cordis tree. To use it, save this configuration as `editor.patch.yml`; `insert` adds both the editor and the filesystem provider that the minimal profile lacks:

```yaml
- insert:
    - id: fs-local
      name: '@worldapptechnologies/nulu-fs-local'
      config:
        cwd: !!js process.cwd()
    - id: tool-str-replace-editor
      name: '@worldapptechnologies/nulu-tool-str-replace-editor'
```

Pass `patches=("/absolute/path/to/editor.patch.yml",)` when constructing `NuluHarness(profile="sdk-minimal", ...)`, or put the patch in `$NULU_HOME/profiles/sdk-minimal/cordis.patch.yml` for persistent configuration. On the next runtime launch, model requests include `str_replace_editor` beside the persistent shell. The local filesystem provider uses the runtime working directory for relative paths; like the minimal shell, it does not confine access to that directory. For the standard `sdk` profile, insert only the editor row so it uses the existing filesystem provider and policies.

## Understand the minimal profile

| Property | Value |
|---|---|
| System prompt | `NULU_SYSTEM_PROMPT`, falling back to `You are a helpful software engineer assistant.` |
| Model in `minimal.py` | `--model`, then `NULU_MODEL`, then `nulu-5` |
| Model-facing tool | Persistent `bash` on Linux/macOS or `pwsh` on Windows |
| Shell timeout | 300 seconds |
| Runtime context and compaction | Absent |
| Session persistence | Uncompressed JSONL under `<nulu_home>/sessions` |

The profile's sole bundle inserts the complete tree over an empty root and does not include `nulu-base`; later base-profile tools therefore cannot appear implicitly. It contains the SDK protocol, one environment-configured Nulu adapter, local execution, and persistence, while filesystem tools, settings, managed credentials, OTel telemetry, Web tools, subagents, local instruction discovery, and compaction are absent. The [Nulu session-log contributor](../../../packages/session/session-log-gateway/README.md) uploads complete unaccepted log suffixes with Nulu requests by default; set `session-log-gateway.enabled: false` in a profile patch to disable it. It pins `danger-full-access`, so the platform-selected persistent shell can modify any path visible to the runtime; use a disposable checkout or container.

The installed wheel still packages the full `web` profile and frontend assets. Run `nulu web` against an explicit `NULU_HOME` when a Python SDK deployment also needs the browser application; `web` is a separate CLI application and cannot serve a Python SDK client.

Use a fresh home when profiles, plugins, credentials, settings, and sessions must be isolated. Use a fresh session id for independent work; reuse a harness, home, and id only to continue the same durable conversation and session-owned resources.

The [bundle reference](../../../packages/bundle/sdk-minimal/README.md) owns the exact tree, and the [example reference](../../../python/sdk/examples/README.md) owns the runnable program. The [Python SDK reference](../../../python/sdk/README.md) covers lifecycle, results, notifications, and low-level behavior; the [nulu CLI reference](../../../apps/cli/reference/README.md) covers profile layering.
