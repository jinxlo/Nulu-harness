import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  resolveDesktopAppId,
  resolveMacOSNotarizationEnvironment,
  resolveMacOSSigningEnvironment,
} from './scripts/desktop-release-environment.mjs'
import { notarizeMacOSDiskImageArtifact } from './scripts/notarize-macos-disk-images.mjs'
import { verifyMacOSSignatureAfterSign } from './scripts/verify-macos-signature.mjs'
import {
  createWindowsTokenSigner,
  installWindowsNsisBootstrapSigner,
} from './scripts/windows-sign.mjs'
import { resolveDesktopAutoUpdateConfig } from './scripts/desktop-auto-update-environment.mjs'
import { desktopTargetBuildPaths, resolveDesktopBuildTarget } from './scripts/desktop-build-paths.mjs'

/**
 * Create electron-builder configuration from one release environment.
 * @param {NodeJS.ProcessEnv} env - Packaging environment.
 * @param {NodeJS.Platform} hostPlatform - Build-host platform used when no explicit target is present.
 * @param {string} hostArch - Build-host architecture used when no explicit target is present.
 * @returns {object} electron-builder configuration.
 */
export function createElectronBuilderConfig(
  env = process.env,
  hostPlatform = process.platform,
  hostArch = process.arch,
) {
  const appId = resolveDesktopAppId(env)
  const targetPlatform = env.NULU_DESKTOP_TARGET_PLATFORM
  const resolvedPlatform = targetPlatform ?? hostPlatform
  const resolvedArch = env.NULU_DESKTOP_TARGET_ARCH ?? hostArch
  if (env.NULU_DESKTOP_UNSIGNED !== undefined && !['0', '1'].includes(env.NULU_DESKTOP_UNSIGNED)) {
    throw new Error('desktop package: NULU_DESKTOP_UNSIGNED must be 0 or 1')
  }
  const unsigned = env.NULU_DESKTOP_UNSIGNED === '1'
  if (unsigned && resolvedPlatform !== 'win32' && resolvedPlatform !== 'darwin') {
    throw new Error('desktop package: unsigned builds require Windows or macOS')
  }
  const packagesMacOS = targetPlatform === 'darwin' || (targetPlatform === undefined && hostPlatform === 'darwin')
  const packagesWindows = targetPlatform === 'win32'
  const macOSSigning = packagesMacOS && !unsigned ? resolveMacOSSigningEnvironment(env) : undefined
  if (packagesMacOS && !unsigned) resolveMacOSNotarizationEnvironment(env)
  const windowsSigner = packagesWindows && !unsigned
    ? createWindowsTokenSigner({
        certificateFile: env.NULU_DESKTOP_WINDOWS_CER_FILE,
        signTool: env.NULU_DESKTOP_WINDOWS_SIGNTOOL,
        tokenPin: env.NULU_DESKTOP_WINDOWS_TOKEN_PIN,
        keyContainer: env.NULU_DESKTOP_WINDOWS_KEY_CONTAINER,
      })
    : undefined
  if (windowsSigner !== undefined) {
    installWindowsNsisBootstrapSigner({ sign: windowsSigner })
  }
  const update = unsigned ? undefined : resolveDesktopAutoUpdateConfig(env, resolvedPlatform, resolvedArch)
  const buildPaths = desktopTargetBuildPaths(resolveDesktopBuildTarget(env, hostPlatform, hostArch))
  return {
    appId,
    productName: 'Nulu Harness',
    copyright: 'Copyright © 2026 World App Technologies',
    artifactName: 'nulu-harness-${version}-${os}-${arch}.${ext}',
    directories: { output: unsigned ? join(buildPaths.root, 'unsigned-artifacts') : buildPaths.artifacts },
    asar: true,
    files: [
      'lib/*.js',
      'lib/*.cjs',
      'renderer/**/*',
      'package.json',
    ],
    asarUnpack: [
      '**/*.{node,dylib,dll,so,exe}',
      '**/*.so.*',
      '**/spawn-helper',
      '**/@vscode/ripgrep/bin/rg',
    ],
    extraResources: [
      { from: buildPaths.runtime, to: 'runtime' },
      // The application reads the runtime tree from `resources/nulu` on disk, so it
      // must be an extra resource, never part of app.asar.
      { from: buildPaths.nulu, to: 'nulu' },
      // electron-builder excludes a source directory's root node_modules.
      { from: join(buildPaths.nulu, 'node_modules'), to: 'nulu/node_modules' },
    ],
    mac: {
      category: 'public.app-category.developer-tools',
      identity: unsigned ? null : macOSSigning?.signingIdentity,
      forceCodeSigning: !unsigned,
      hardenedRuntime: true,
      // ASAR-unpacked native runtime files are pre-signed; PAK resources are sealed by their enclosing bundle.
      signIgnore: ['/Contents/Resources/nulu(?:/|$)', '\\.pak$'],
      notarize: true,
      target: ['dmg', 'zip'],
    },
    dmg: {
      sign: true,
      writeUpdateInfo: false,
    },
    afterSign: async context => {
      if (unsigned || context.electronPlatformName !== 'darwin') return
      verifyMacOSSignatureAfterSign(context, macOSSigning ?? resolveMacOSSigningEnvironment(env))
    },
    artifactBuildCompleted: artifact => {
      if (unsigned || !artifact.file.endsWith('.dmg')) return
      return notarizeMacOSDiskImageArtifact(
        artifact,
        env,
        macOSSigning ?? resolveMacOSSigningEnvironment(env),
      )
    },
    win: {
      // NSIS publisher metadata; must match the code-signing certificate subject
      // once a certificate is configured.
      publisherName: 'World App Technologies',
      forceCodeSigning: !unsigned,
      signtoolOptions: {
        sign: windowsSigner,
        signingHashAlgorithms: ['sha256'],
      },
      target: ['nsis'],
    },
    linux: {
      category: 'Development',
      // The scoped package name cannot become the AppImage executable name.
      executableName: 'nulu-harness',
      target: ['AppImage'],
    },
    nsis: {
      include: fileURLToPath(new URL('./scripts/installer.nsh', import.meta.url)),
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      differentialPackage: true,
    },
    publish: update === undefined ? null : [{ provider: 'generic', url: update.publicUrl }],
  }
}

export default createElectronBuilderConfig()
