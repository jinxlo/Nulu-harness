/** Lightweight GitHub-releases update check for the desktop shell. */

import { gt, valid } from 'semver'

/**
 * Repository the desktop updater watches for new releases. Overridable through
 * environment so forks and staging builds can point at a different feed without
 * code changes.
 */
export function githubReleaseOwner(env: NodeJS.ProcessEnv = process.env): string {
  return env.NULU_GITHUB_UPDATE_OWNER?.trim() || 'worldapptechnologies'
}

export function githubReleaseRepo(env: NodeJS.ProcessEnv = process.env): string {
  return env.NULU_GITHUB_UPDATE_REPO?.trim() || 'nulu-harness'
}

/** One published GitHub release reduced to the facts the updater needs. */
export interface GitHubReleaseInfo {
  /** Normalized semantic version parsed from the release tag. */
  readonly version: string
  /** Raw tag name (may carry a leading `v`). */
  readonly tagName: string
  /** Release title, falling back to the tag when unnamed. */
  readonly name: string
  /** Public release page used by the "download" action. */
  readonly url: string
  /** ISO publish timestamp. */
  readonly publishedAt: string
}

/**
 * Fetch the newest published release for a repository.
 *
 * `releases/latest` only resolves stable (non-prerelease) releases, so when a
 * repo has published only prereleases the endpoint returns 404 and we fall back
 * to scanning the newest releases list by semantic version.
 * @param owner - repository owner.
 * @param repo - repository name.
 * @returns the newest release, or null when none is published or the endpoint is unreachable.
 */
export async function fetchLatestGitHubRelease(
  owner: string = githubReleaseOwner(),
  repo: string = githubReleaseRepo(),
): Promise<GitHubReleaseInfo | null> {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'nulu-harness-desktop',
  }
  const latest = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
    headers,
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null)
  if (latest !== null && latest.ok) {
    const parsed = parseRelease(await latest.json())
    if (parsed !== null) return parsed
  }
  const list = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`, {
    headers,
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null)
  if (list === null || !list.ok) return null
  const releases = (await list.json()) as unknown[]
  return releases.reduce<GitHubReleaseInfo | null>((newest, entry) => {
    const parsed = parseRelease(entry)
    if (parsed === null) return newest
    return newest === null || gt(parsed.version, newest.version) ? parsed : newest
  }, null)
}

function parseRelease(entry: unknown): GitHubReleaseInfo | null {
  if (entry === null || typeof entry !== 'object') return null
  const payload = entry as { tag_name?: unknown; name?: unknown; html_url?: unknown; published_at?: unknown }
  const tagName = typeof payload.tag_name === 'string' ? payload.tag_name.replace(/^v/, '') : ''
  const version = valid(tagName)
  if (version === null) return null
  return {
    version,
    tagName,
    name: typeof payload.name === 'string' && payload.name.length > 0 ? payload.name : tagName,
    url: typeof payload.html_url === 'string' ? payload.html_url : '',
    publishedAt: typeof payload.published_at === 'string' ? payload.published_at : '',
  }
}

/**
 * Whether `latest` is a strictly newer semantic version than `current`.
 * @returns true when `latest` should prompt the user to update.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const installed = valid(current)
  const published = valid(latest)
  if (installed === null || published === null) return false
  return gt(published, installed)
}
