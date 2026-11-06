# Nulu Harness

Nulu Harness is the AI coding agent from [Nulu AI](https://www.nuluai.com). It works directly in your project: it reads and edits files, runs commands, keeps a plan, and uses Nulu AI models through your Nulu AI account.

## Install

Requires Node.js 22.19 or later (24 recommended).

```sh
npm install -g nulu-harness
```

## Run

```sh
cd my-project
nulu
```

`nulu` starts Nulu Harness for the current folder, prints its local address with an access code, and opens it in your browser. `nulu web --no-open` starts it without opening a browser, and `nulu --help` lists every command.

Run one task and print the answer without the interface:

```sh
nulu --profile headless "Summarize this repository"
```

## Connect to Nulu AI

Create an API key in [Nulu Console](https://platform.nuluai.com). Then either open **Settings → Models** in Nulu Harness and paste the key, or set it before starting:

```sh
export WORLD_APP_TECHNOLOGIES_API_KEY=your-key
```

Usage is billed to your Nulu AI credits at current rates. Nulu 5 Ultra is the default model; Nulu 5 Pro is available from the model selector.

## Update

```sh
npm install -g nulu-harness@latest
```

## Documentation and desktop app

- Getting started guide: https://www.nuluai.com/learn/harness
- Desktop application for Windows, macOS, and Linux: https://www.nuluai.com/harness

Nulu Harness is in developer preview. It can run commands and change files in the folder you open; review the actions it proposes.

## License

MIT. Nulu Harness is distributed by Nulu AI, a World App Technologies company, and includes software under the MIT License and other open-source licenses; the license text ships in this package and in each package it installs. See https://www.nuluai.com/third-party-notices.
