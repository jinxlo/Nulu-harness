# Nulu Harness

[English](README.md) | 中文

Nulu Harness（`nulu`）是由 [World App Technologies](https://worldapptechnologies.com) 开发的开源 agent harness（智能体框架），派生自 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 项目。

它构建于**一切皆插件**的架构之上，由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512)。

文档：[https://worldapptechnologies.github.io/nulu-harness/nulu-harness/](https://worldapptechnologies.github.io/nulu-harness/nulu-harness/)

## 开发者预览

Nulu Harness 处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

运行本项目前，请阅读[安全说明](SAFETY.zh.md)。

<a id="run"></a>

## 运行

Nulu Harness 有三种运行方式：桌面应用、`nulu` 命令行，或源码检出。三种方式运行同一套 harness；用户数据存放在 `$NULU_HOME`（默认为 `~/.nulu`）。

### 桌面应用

从 [GitHub Releases](https://github.com/worldapptechnologies/nulu-harness/releases) 下载对应平台的安装包：

| 平台 | 安装包 |
|---|---|
| Windows x64 | `nulu-harness-<version>-win-x64.exe` |
| macOS Apple 芯片 | `nulu-harness-<version>-mac-arm64.dmg` |
| macOS Intel | `nulu-harness-<version>-mac-x64.dmg` |
| Linux x64 | `nulu-harness-<version>-linux-x64.AppImage` |

桌面应用自带运行时，无需安装 `Node.js`、`git`，也无需使用终端。首次启动会显示欢迎界面并要求输入 World App Technologies API key；密钥保存在本地 Nulu 数据目录。发布安装包目前尚未签名，macOS 与 Windows 可能显示安全警告；签名要求见[桌面打包说明](apps/desktop/README.zh.md)。

### 通过 `npm` 运行

安装 `Node.js`（22.19+ 或 24+），然后运行：

```sh
npx @worldapptechnologies/nulu web
```

该命令默认会在 `http://127.0.0.1:3080` 启动 Web UI，本机启动时还会用默认浏览器打开页面。通过 SSH 启动时只打印宿主机 URL，因为本地转发地址由 SSH 客户端或编辑器持有。传入 `--no-open` 可仅运行服务器而不打开浏览器。详见 [Web UI 指南](docs/user/guide/index.zh.md)。

### 通过 Docker 运行

构建镜像并在后台运行：

```sh
docker build -t nulu-harness .
docker run --network host -v nulu-data:/data/nulu nulu-harness
```

Web UI 位于 `http://127.0.0.1:3080`。随附 profile 仅绑定 loopback，因此 Linux 上必须使用 `--network host`，端口映射无法暴露服务。用户数据保存在 `nulu-data` 卷中。

<a id="run-from-source"></a>

### 从源码运行

如需从仓库源码运行：

```sh
git clone https://github.com/worldapptechnologies/nulu-harness.git
cd nulu-harness
pnpm install
pnpm run build
pnpm nulu web
```

`pnpm run build` 会准备仓库产物。`pnpm nulu web` 会直接使用这些已构建产物，不会重新构建。

## 社区与支持

- 通过 [GitHub Discussions](https://github.com/worldapptechnologies/nulu-harness/discussions) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`nulu-plugin`](https://github.com/topics/nulu-plugin) 话题，便于被发现。
- 访问 [World App Technologies](https://worldapptechnologies.com) 获取公司与产品动态。

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.zh.md)。

## 开发

请先阅读[开发指南](docs/development.zh.md)与[架构文档](docs/architecture.zh.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 引用

```bibtex
@misc{nulu-harness2026,
  title={Nulu Harness: Everything is a Plugin},
  author={World App Technologies},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/worldapptechnologies/nulu-harness}},
}
```

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
