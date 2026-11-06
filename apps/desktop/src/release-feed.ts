/** The release catalog on the Nulu download host: how the desktop shell learns of a newer version and where its files are. */

import { gt, valid } from 'semver'

/** Page a person opens to download an installer by hand. */
export const RELEASE_PAGE = 'https://www.nuluai.com/harness'

const DEFAULT_RELEASE_ORIGIN = 'https://platform.nuluai.com/downloads/harness'

/**
 * Directory that holds `nulu-release.json`, the installers, and each version's checksum list.
 * `NULU_RELEASE_ORIGIN` points staging builds at another HTTPS directory; any other value is ignored.
 * @param env - process environment.
 * @returns the directory address without a trailing slash.
 */
export function releaseOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.NULU_RELEASE_ORIGIN?.trim()
  const origin = configured !== undefined && configured.startsWith('https://') ? configured : DEFAULT_RELEASE_ORIGIN
  return origin.replace(/\/+$/u, '')
}

/** The newest published release reduced to the facts the updater needs. */
export interface ReleaseInfo {
  /** Normalized semantic version of the release. */
  readonly version: string
  /** Page that offers its installers. */
  readonly url: string
}

/**
 * Read the newest published release from the catalog.
 * @param origin - release directory; defaults to the configured one.
 * @returns the release, or null when the catalog is unreachable or not a stable release catalog.
 */
export async function fetchLatestRelease(origin: string = releaseOrigin()): Promise<ReleaseInfo | null> {
  const response = await fetch(`${origin}/nulu-release.json`, {
    headers: { accept: 'application/json', 'user-agent': 'nulu-harness-desktop' },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null)
  if (response === null || !response.ok) return null
  const catalog = await response.json().catch(() => null) as { schemaVersion?: unknown; version?: unknown } | null
  if (catalog === null || catalog.schemaVersion !== 1 || typeof catalog.version !== 'string') return null
  const version = valid(catalog.version)
  return version === null ? null : { version, url: RELEASE_PAGE }
}

/**
 * Whether `latest` is a strictly newer semantic version than `current`.
 * @param current - version of the running application.
 * @param latest - version the catalog names.
 * @returns true when `latest` should prompt the user to update.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const installed = valid(current)
  const published = valid(latest)
  if (installed === null || published === null) return false
  return gt(published, installed)
}
