/**
 * Resolve the public SDK launch configuration to one nulu subprocess.
 * @module @worldapptechnologies/nulu-sdk-client/launch
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HarnessClientOptions } from './types.ts'

/** Default bound for a profile to answer the SDK initialize handshake. */
export const DEFAULT_INITIALIZE_TIMEOUT_MS = 10_000

/** Internal generic process launch used by the transport and fake-runtime tests. */
export interface RuntimeProcessOptions {
  command: string
  args: string[]
  cwd?: string
  /** Materialize the complete child environment when the client starts its subprocess. */
  environment: () => NodeJS.ProcessEnv
  description: string
  initializeTimeoutMs: number
  requestTimeoutMs?: number
  shutdownTimeoutMs?: number
  disposeEofGraceMs?: number
  disposeGraceMs?: number
}

/** Node argv plus internal profile patches required by one resolved nulu entry. */
export interface NuluNodeLaunch {
  /** Arguments before the profile selector. */
  nodeArgs: string[]
  /** Internal patches applied below caller-supplied patches. */
  patches: string[]
  /** Environment values required by the resolved entry mode. */
  environment: NodeJS.ProcessEnv
}

interface PackageManifest {
  version?: unknown
  bin?: unknown
}

/** Read a package manifest from one resolved package.json URL. */
function manifest(url: string): PackageManifest {
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as PackageManifest
}

/**
 * Resolve and version-check a nulu executable from package manifests.
 * @param nuluManifestUrl - resolved URL of the nulu package manifest.
 * @param clientManifestUrl - resolved URL of the SDK client manifest.
 * @returns the absolute nulu executable path.
 */
export function resolveNuluBinFromManifests(nuluManifestUrl: string, clientManifestUrl: string): string {
  const nuluManifest = manifest(nuluManifestUrl)
  const clientManifest = manifest(clientManifestUrl)
  if (typeof nuluManifest.version !== 'string' || nuluManifest.version !== clientManifest.version) {
    throw new Error(`nulu SDK client ${String(clientManifest.version)} requires the same nulu version, got ${String(nuluManifest.version)}`)
  }
  const bin = typeof nuluManifest.bin === 'object' && nuluManifest.bin !== null
    ? (nuluManifest.bin as Record<string, unknown>).nulu
    : nuluManifest.bin
  if (typeof bin !== 'string' || bin === '') throw new Error('@worldapptechnologies/nulu declares no nulu executable')
  return resolve(dirname(fileURLToPath(nuluManifestUrl)), bin)
}

/**
 * Resolve and version-check the built nulu executable installed with this SDK.
 * @returns the absolute built executable path, whether or not it exists in a source checkout.
 */
export function installedNuluBin(): string {
  return resolveNuluBinFromManifests(
    import.meta.resolve('@worldapptechnologies/nulu/package.json'),
    new URL('../package.json', import.meta.url).href,
  )
}

/**
 * Resolve the Node launch for one same-version nulu package.
 * @param nuluManifestUrl - resolved URL of the nulu package manifest.
 * @param clientManifestUrl - resolved URL of the SDK client manifest.
 * @param sourceLoaderUrl - optional absolute tsx loader URL for deterministic tests.
 * @returns built output, or the source entry plus its compatibility patch and tsx environment.
 */
export function resolveNuluNodeLaunchFromManifests(
  nuluManifestUrl: string,
  clientManifestUrl: string,
  sourceLoaderUrl?: string,
): NuluNodeLaunch {
  const bin = resolveNuluBinFromManifests(nuluManifestUrl, clientManifestUrl)
  if (existsSync(bin)) return { nodeArgs: [bin], patches: [], environment: {} }

  const packageDir = dirname(fileURLToPath(nuluManifestUrl))
  const sourceBin = resolve(packageDir, 'src/bin.ts')
  const sourcePatch = resolve(packageDir, 'src/sdk-source.cordis.patch.yml')
  const sourceTsconfig = resolve(packageDir, 'tsconfig.json')
  if (!existsSync(sourceBin) || !existsSync(sourcePatch) || !existsSync(sourceTsconfig)) {
    throw new Error(
      `@worldapptechnologies/nulu is missing its built executable ${bin} and complete source launch files ${sourceBin}, ${sourcePatch}, ${sourceTsconfig}`,
    )
  }
  const loader = sourceLoaderUrl ?? import.meta.resolve('tsx/esm')
  return {
    nodeArgs: ['--import', loader, sourceBin],
    patches: [sourcePatch],
    environment: { TSX_TSCONFIG_PATH: sourceTsconfig },
  }
}

/**
 * Resolve the installed nulu package to a built or source Node launch.
 * @returns the launch descriptor for the current checkout or installed package.
 */
function installedNuluNodeLaunch(): NuluNodeLaunch {
  return resolveNuluNodeLaunchFromManifests(
    import.meta.resolve('@worldapptechnologies/nulu/package.json'),
    new URL('../package.json', import.meta.url).href,
  )
}

/**
 * Resolve caller-relative filesystem inputs and construct canonical nulu argv.
 * @param options - public SDK launch options.
 * @param callerCwd - parent-process directory used for lexical resolution.
 * @returns one generic subprocess spec for the JSON-RPC transport.
 */
export function resolveNuluLaunch(
  options: HarnessClientOptions = {},
  callerCwd: string = process.cwd(),
): RuntimeProcessOptions {
  const profile = options.profile ?? 'sdk'
  const nuluLaunch = options.nuluBin === undefined
    ? installedNuluNodeLaunch()
    : { nodeArgs: [resolve(callerCwd, options.nuluBin)], patches: [], environment: {} }
  const patches = [
    ...nuluLaunch.patches,
    ...(options.patches ?? []).map(path => resolve(callerCwd, path)),
  ]
  const nuluHome = options.nuluHome === undefined ? undefined : resolve(callerCwd, options.nuluHome)
  return {
    command: process.execPath,
    args: [...nuluLaunch.nodeArgs, '--profile', profile, ...patches.flatMap(path => ['--patch', path])],
    ...options.processCwd === undefined ? {} : { cwd: resolve(callerCwd, options.processCwd) },
    environment: () => ({
      ...(options.env ?? process.env),
      ...nuluLaunch.environment,
      ...nuluHome === undefined ? {} : { NULU_HOME: nuluHome },
    }),
    description: `nulu profile ${JSON.stringify(profile)}`,
    initializeTimeoutMs: options.initializeTimeoutMs ?? DEFAULT_INITIALIZE_TIMEOUT_MS,
    ...options.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: options.requestTimeoutMs },
    ...options.shutdownTimeoutMs === undefined ? {} : { shutdownTimeoutMs: options.shutdownTimeoutMs },
    ...options.disposeEofGraceMs === undefined ? {} : { disposeEofGraceMs: options.disposeEofGraceMs },
    ...options.disposeGraceMs === undefined ? {} : { disposeGraceMs: options.disposeGraceMs },
  }
}
