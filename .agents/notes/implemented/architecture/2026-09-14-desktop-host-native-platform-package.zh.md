# Agent Note: 在桌面载荷中打包宿主原生平台包

Status: implemented

[English](2026-09-14-desktop-host-native-platform-package.md) | 中文

## 问题

[预编译系统原语](2026-09-07-prebuilt-system-primitives.zh.md) 用 `@worldapptechnologies/node-addon-system` 取代了需要编译的 `fs-ext` 依赖：`flock` addon 承载 POSIX 会话写租约，`landlock-run` 承载 Desktop 沙箱启动器。两者都从入口包旁边的按平台包 `@worldapptechnologies/node-addon-system-<os>-<cpu>` 解析各自的二进制文件。

桌面打包只把入口包打进 Landlock 压缩包目录，既不构建也不打包平台包，而 npm registry 上没有任何 `@worldapptechnologies` 平台包。因此准备好的载荷缺少 `bin/landlock-run` 与 `bin/glibc/system.node`；Linux 和 macOS 上的会话写入以 `MODULE_NOT_FOUND` 失败。与此同时，载荷 smoke fixture 仍在要求已被移除的 `fs-ext` 包，所以 Linux 安装包构建在 electron-builder 之前就停止了。

## 决策

`apps/desktop/scripts/package-target.ts` 现在会构建完整的宿主原生载荷（`pnpm --dir native/system run build:native`），并在打包入口包之前，只要目标声明了平台包，就把宿主平台包打进目标的 Landlock 压缩包目录。平台包必须与打包宿主匹配；无法在当前宿主构建其原生载荷的目标会在打包前失败，而不是交付一个缺少绑定的载荷。`apps/desktop/scripts/prepare-package-set.ts` 会像其他 optional dependency 一样把平台压缩包选入桌面包闭包，运行时复制过滤器也允许其 `bin/` 文件通过。

载荷 smoke fixture 改为检查 flock 绑定而不是 `fs-ext`：它获取锁，验证第二个描述符被以 `EAGAIN`/`EWOULDBLOCK` 拒绝；在 Windows 上则验证被以不支持平台拒绝，因为 Windows 通过 Koffi 加锁。`.github/workflows/desktop-build.yml` 在 Linux lane 上安装 `musl-tools`，与原生工作区 workflow 一致，因为平台载荷包含静态 musl 的 Landlock 启动器与 musl addon。

## 考虑过的替代方案

**在载荷准备时从 npm registry 解析平台包。** registry 上该包族发布在上游 `@deepseek-ai` scope 下，而不是 `@worldapptechnologies`，所以载荷准备在每个平台上都会失败。依赖 registry 也会破坏离线和固定版本构建。

**把平台二进制文件复制进入口包压缩包。** 入口包把二进制文件保存在可替换的平台包中；把二进制复制进入口压缩包会让同一份字节出现第二种分发形态，并偏离原生发布产物。

**为载荷 smoke 恢复 `fs-ext`。** 没有任何 manifest 声明该依赖；smoke 必须检验实际随包发布的绑定，而陈旧的 fixture 恰恰掩盖了缺失的平台包。

**在 Apple Silicon 宿主面向 Intel macOS 时交叉构建平台包。** `native/system/scripts/build.ts` 只构建宿主载荷。Rosetta 开发路径现在会以明确的错误信息停止，而不是产出一个其 addon 无法在 x64 运行时加载的载荷。

## 后果

- 桌面载荷包含与原生发布相同的启动器和 addon 字节，因此 Linux 与 macOS 会话无需 registry 访问即可加锁和沙箱化。
- Linux 打包 lane 和本地 Linux 构建需要 `musl-tools`；原生载荷构建会让每条桌面打包命令多花几秒。
- 从 Apple Silicon 宿主打包 Intel macOS 会被拒绝；CI 矩阵在 `macos-15-intel` 上构建该目标。
- Windows 桌面载荷保留入口包并跳过平台包，与该包族的 Windows 支持一致（Koffi 加锁，无 Landlock 启动器）。
