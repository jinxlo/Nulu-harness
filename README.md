# Nulu Harness

English | [Español](README.es.md)

Nulu Harness (`nulu`) is an open-source agent harness developed by [World App Technologies](https://worldapptechnologies.com).

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512).

Documentation: [https://worldapptechnologies.github.io/nulu-harness/nulu-harness/](https://worldapptechnologies.github.io/nulu-harness/nulu-harness/)

## Developer preview

Nulu Harness is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

Review the [safety notice](SAFETY.md) before running the project.

## Run

Nulu Harness runs three ways: the desktop application, the `nulu` command line, or a source checkout. Every path runs the same harness; user data lives under `$NULU_HOME` (default `~/.nulu`).

### Desktop application

Download the installer for your platform from [GitHub Releases](https://github.com/worldapptechnologies/nulu-harness/releases):

| Platform | Installer |
|---|---|
| Windows x64 | `nulu-harness-<version>-win-x64.exe` |
| macOS Apple silicon | `nulu-harness-<version>-mac-arm64.dmg` |
| macOS Intel | `nulu-harness-<version>-mac-x64.dmg` |
| Linux x64 | `nulu-harness-<version>-linux-x64.AppImage` |

The desktop application bundles its own runtime and needs no installed `Node.js`, `git`, or terminal. The first launch shows a welcome screen that asks for a World App Technologies API key and stores it in the local Nulu data directory. Release installers are currently unsigned, so macOS and Windows may show a security warning; the [desktop packaging notes](apps/desktop/README.md) cover signing requirements.

### Run from `npm`

Install `Node.js` (22.19+ or 24+), then run:

```sh
npx @worldapptechnologies/nulu web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run with Docker

Build the image and run it in the background:

```sh
docker build -t nulu-harness .
docker run --network host -v nulu-data:/data/nulu nulu-harness
```

The Web UI is at `http://127.0.0.1:3080`. The shipped profile binds loopback only, so `--network host` is required on Linux and port publishing cannot expose the server. User data persists in the `nulu-data` volume.

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/worldapptechnologies/nulu-harness.git
cd nulu-harness
pnpm install
pnpm run build
pnpm nulu web
```

`pnpm run build` prepares the repository artifacts. `pnpm nulu web` uses those built artifacts without rebuilding.

## Community and support

- Submit feedback or bug reports through [GitHub Discussions](https://github.com/worldapptechnologies/nulu-harness/discussions).
- Add the [`nulu-plugin`](https://github.com/topics/nulu-plugin) topic to your plugin repository for discoverability.
- Visit [World App Technologies](https://worldapptechnologies.com) for company and product updates.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## Citation

```bibtex
@misc{nulu-harness2026,
  title={Nulu Harness: Everything is a Plugin},
  author={World App Technologies},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/worldapptechnologies/nulu-harness}},
}
```

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
