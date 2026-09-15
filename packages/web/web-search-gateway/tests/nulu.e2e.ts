import { describe, expect, it } from 'vitest'
import {
  NuluSearchProvider,
  GATEWAY_DEFAULT_API_VERSION,
  GATEWAY_DEFAULT_BASE_URL,
  GATEWAY_DEFAULT_MAX_TOKENS,
  GATEWAY_DEFAULT_MAX_USES,
  GATEWAY_DEFAULT_MODEL,
} from '@worldapptechnologies/nulu-web-search-gateway'

/** Construct the provider over a fixed options value; production passes a live thunk. */
import type { NuluSearchProviderOptions } from '@worldapptechnologies/nulu-web-search-gateway'

const searchProvider = (options: NuluSearchProviderOptions): NuluSearchProvider =>
  new NuluSearchProvider(() => options)

/**
 * Disabled real-API probe for the Nulu search provider. The live endpoint
 * can complete without structured source blocks, so this is not a reliable
 * merge signal. Its body remains because mocks cannot confirm the wire shape.
 */
const apiKey = process.env.WORLD_APP_TECHNOLOGIES_API_KEY
const maybe = apiKey !== undefined && apiKey.length > 0 ? describe : describe.skip

maybe('NuluSearchProvider real API', () => {
  it.skip('returns citeable sources for a live query via native web_search', async () => {
    const provider = searchProvider({
      apiKey: apiKey!,
      baseURL: process.env.WORLD_APP_TECHNOLOGIES_SEARCH_BASE_URL ?? GATEWAY_DEFAULT_BASE_URL,
      model: process.env.WORLD_APP_TECHNOLOGIES_SEARCH_MODEL ?? GATEWAY_DEFAULT_MODEL,
      apiVersion: GATEWAY_DEFAULT_API_VERSION,
      maxTokens: GATEWAY_DEFAULT_MAX_TOKENS,
      maxUses: GATEWAY_DEFAULT_MAX_USES,
    })
    const result = await provider.search({ query: 'What is Nulu Harness?', maxResults: 5 })
    expect(result.sources.length).toBeGreaterThan(0)
    for (const source of result.sources) expect(source.url).toMatch(/^https?:\/\//)
  }, 60_000)
})
