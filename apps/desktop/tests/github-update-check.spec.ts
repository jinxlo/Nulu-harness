import { afterEach, expect, it, vi } from 'vitest'
import { fetchLatestGitHubRelease, githubReleaseOwner, githubReleaseRepo } from '../src/github-update-check.ts'

afterEach(() => { vi.unstubAllGlobals() })

it('uses the repository that actually publishes the desktop installers', () => {
  expect(githubReleaseOwner({})).toBe('jinxlo')
  expect(githubReleaseRepo({})).toBe('Nulu-harness')
  expect(githubReleaseOwner({ NULU_GITHUB_UPDATE_OWNER: 'staging' })).toBe('staging')
})

it('ignores draft and prerelease entries before selecting a published update', async () => {
  const entry = { tag_name: 'v1.6.1', name: 'Nulu Harness', html_url: 'https://github.com/jinxlo/Nulu-harness/releases/tag/v1.6.1', published_at: '2026-11-04T00:00:00Z', draft: false, prerelease: false }
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ ...entry, tag_name: 'v9.0.0', draft: true }))
    .mockResolvedValueOnce(Response.json([{ ...entry, tag_name: 'v8.0.0', prerelease: true }, entry]))
  vi.stubGlobal('fetch', fetcher)
  expect((await fetchLatestGitHubRelease())?.version).toBe('1.6.1')
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.github.com/repos/jinxlo/Nulu-harness/releases/latest')
})
