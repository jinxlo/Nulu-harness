# Agent Note: 增加 Linux x64 桌面发布目标与未签名 macOS 测试通道

Status: implemented

[English](2026-09-14-desktop-linux-target-and-unsigned-macos.md) | 中文

## 问题

桌面发布矩阵此前只有 macOS arm64/x64 与 Windows x64 通道。Linux 用户没有可安装的桌面产物，CI 在没有生产签名凭据时无法产出安装器，且唯一的未签名通道只覆盖 Windows，因此 macOS 和 Windows 的测试安装需要本地拼装产物。

## 决策

Linux x64 是受支持的桌面发布目标。`package:desktop:linux:x64` 在 Linux x64 主机上按 `apps/desktop/electron-builder.config.mjs` 打包 AppImage。该目标进入更新环境词汇表（`apps/desktop/scripts/desktop-auto-update-environment.mjs` 中的 `linux-x64`），渠道元数据解析为 `latest-linux.yml` 或预发布版的 `<channel>-linux.yml`。Linux 产物作为 GitHub Release 资源分发，而不走 COS 上传：`apps/desktop/scripts/desktop-upload-plan.ts` 为已签名的 macOS 与 Windows 渠道保留经过验证的上传计划，因为 AppImage 没有平台签名步骤，而上传计划要求已签名产物。electron-builder 会从包名推导 AppImage 可执行文件名，因此 `apps/desktop/electron-builder.config.mjs` 将 `linux.executableName` 固定为 `nulu-harness`，而不是带作用域的 `@worldapptechnologies/nulu-desktop`。

`--unsigned` 打包调用支持 macOS 与 Windows。macOS 未签名打包通过与 Windows 相同的清洗环境移除 Developer ID 身份、公证和发布完成记录，并把产物隔离到目标的 `unsigned-artifacts` 目录。`package-target.ts` 对 Linux 拒绝 `--unsigned`，因为 Linux 打包没有可移除的签名输入，其错误信息会列出接受的平台。常规打包命令即使父进程请求未签名模式也会显式选择签名模式，因此未签名产物不可能通过发布上传校验。

`.github/workflows/desktop-build.yml` 在手动触发时打包整个矩阵：`ubuntu-24.04` 运行常规 linux-x64 命令，`macos-15`（mac-arm64）、`macos-15-intel`（mac-x64）和 `windows-2025`（win-x64）运行未签名命令。每条通道把各自的产物目录（`artifacts` 或 `unsigned-artifacts`）上传为工作流产物。可选的发布任务仅在设置 `publish_release` 时运行，要求提供 `release_tag`，下载全部通道产物，并通过 `gh release create --draft --generate-notes` 创建 GitHub 草稿发布；该任务绝不会把草稿提升为公开发布。

本决策取代[打包决策](../architecture/2026-08-25-electron-desktop-packaging-and-updates.zh.md)中的初始平台决定与仅限 Windows 的未签名范围。签名、公证、更新托管与发布身份仍由该记录负责。

## 考虑过的替代方案

**对 Linux 产物签名并公证。** AppImage 发布流程没有 Linux 签名身份或公证步骤，而 COS 上传计划要求已签名产物。Linux 改为通过 GitHub Releases 发布，而不是削弱该验证。

**把 COS 上传计划扩展到未签名目标。** 该计划在替换上一渠道前验证已签名更新负载与渠道元数据。接受未签名目标要么放弃该验证，要么发明一个发布环境并不具备的 Linux 签名步骤。

**在 Linux 运行器上构建 macOS 或 Windows。** 原生依赖与 electron-builder 要求目标主机，Developer ID 与 EV Token 访问也留在各自的运行器上。

**让 macOS 未签名通道像此前的 Windows 一样仅限本地。** 在 CI 中验证可安装的 macOS 测试包需要一条在没有 Developer ID 时即可运行的通道，这是仅限本地的命令无法提供的。

**在 CI 中要求签名凭据。** 测试通道先于签名基础设施存在；未签名安装器在不使用证书的情况下执行相同的构建与运行时准备，并且不具备上传资格。

## 后果

- Linux x64 桌面用户从 GitHub Release 安装 AppImage；没有任何 Linux 包进入更新上传。
- CI 在没有 Developer ID 或 EV 凭据的情况下产出 macOS 与 Windows 测试安装器，已签名的生产通道保留其凭据要求。
- 未签名产物继续隔离在 `unsigned-artifacts` 下，并从更新配置和发布完成记录中省略。
- 发布任务只创建草稿；发布仍是单独的显式操作。
- 更新元数据文件名覆盖新目标，因此后续 Linux 更新渠道无需新增命名工作。
