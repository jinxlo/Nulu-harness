import { afterEach, expect, it, vi } from 'vitest'
import { fetchLatestRelease, isNewerVersion, RELEASE_PAGE, releaseOrigin } from '../src/release-feed.ts'

afterEach(() => { vi.unstubAllGlobals() })

it('reads releases from the Nulu download host unless an HTTPS staging directory is configured', () => {
  expect(releaseOrigin({})).toBe('https://platform.nuluai.com/downloads/harness')
  expect(releaseOrigin({ NULU_RELEASE_ORIGIN: 'https://staging.example/harness/' })).toBe('https://staging.example/harness')
  expect(releaseOrigin({ NULU_RELEASE_ORIGIN: 'http://127.0.0.1:8080/harness' })).toBe('https://platform.nuluai.com/downloads/harness')
})

it('takes the version from the catalog and sends people to the Nulu download page', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ schemaVersion: 1, version: '1.6.4', downloads: [] }))
  vi.stubGlobal('fetch', fetcher)
  await expect(fetchLatestRelease()).resolves.toEqual({ version: '1.6.4', url: RELEASE_PAGE })
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://platform.nuluai.com/downloads/harness/nulu-release.json')
  expect(RELEASE_PAGE).toBe('https://www.nuluai.com/harness')
})

it('reports no release for an unreachable, foreign or malformed catalog', async () => {
  for (const answer of [
    () => Promise.reject(new Error('offline')),
    () => Promise.resolve(new Response('missing', { status: 404 })),
    () => Promise.resolve(new Response('<html>')),
    () => Promise.resolve(Response.json({ schemaVersion: 2, version: '9.0.0' })),
    () => Promise.resolve(Response.json({ schemaVersion: 1, version: 'latest' })),
  ]) {
    vi.stubGlobal('fetch', vi.fn(answer))
    await expect(fetchLatestRelease()).resolves.toBeNull()
  }
})

it('offers only strictly newer versions', () => {
  expect(isNewerVersion('1.6.3', '1.6.4')).toBe(true)
  expect(isNewerVersion('1.6.4', '1.6.4')).toBe(false)
  expect(isNewerVersion('1.6.4', 'not-a-version')).toBe(false)
})
