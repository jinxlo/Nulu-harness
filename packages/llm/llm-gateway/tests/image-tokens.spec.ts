import { describe, expect, it } from 'vitest'
import { nuluImageTokens, nuluRequestImageDimensions } from '../src/common/image-tokens.ts'

describe('Nulu image tokens', () => {
  // Reference values from the provider's published image token calculator
  // (api-docs.nulu.com, Token & Token Usage) in its v41 configuration.
  it.each([
    [100, 100, 184],
    [544, 544, 184],
    [640, 480, 206],
    [800, 800, 422],
    [1024, 768, 496],
    [1066, 600, 407],
    [1300, 1300, 994],
    [1920, 1080, 968],
    [2000, 2000, 994],
    [5000, 5000, 994],
    [300, 50, 200],
    [8192, 100, 593],
    [16, 8192, 590],
  ])('prices %sx%s as %s tokens', (width, height, expected) => {
    expect(nuluImageTokens(width, height)).toBe(expected)
  })

  it('caps every image at 1024 tokens regardless of source size', () => {
    for (const [width, height] of [[2000, 2000], [5000, 5000], [8192, 8192], [16, 8192], [9000, 1], [1, 9000]]) {
      expect(nuluImageTokens(width!, height!)).toBeLessThanOrEqual(1024)
    }
  })

  it('prices small images at the documented scale-up floor', () => {
    // Below roughly 544x544 total pixels the provider scales up, so a tiny
    // square costs the same as a 544x544 one.
    expect(nuluImageTokens(100, 100)).toBe(nuluImageTokens(544, 544))
  })

  it('solves a one-row grid for an extremely wide image', () => {
    expect(nuluImageTokens(9000, 1)).toBe(1024)
  })

  it('solves a one-column grid for an extremely tall image', () => {
    expect(nuluImageTokens(1, 9000)).toBe(1024)
  })

  it('converges through repeated projection passes when the first is not a fixpoint', () => {
    expect(nuluImageTokens(12, 1123)).toBe(380)
    expect(nuluImageTokens(89, 2076)).toBe(254)
  })
})

describe('Nulu request image dimensions', () => {
  it('can cross a token-cell boundary when preserving the source aspect ratio', () => {
    const sent = nuluRequestImageDimensions(1224, 1429)
    expect(sent).toEqual({ width: 1187, height: 1386 })
    expect(nuluImageTokens(1224, 1429)).toBe(959)
    expect(nuluImageTokens(sent.width, sent.height)).toBe(992)
  })

  it.each([
    [800, 800, 800, 800],
    [1302, 1302, 1302, 1302],
    [8192, 78, 8192, 78],
    [1, 9000, 1, 9000],
  ])('sends %sx%s unchanged because its padded grid fits the cap', (width, height, expectedWidth, expectedHeight) => {
    expect(nuluRequestImageDimensions(width, height)).toEqual({ width: expectedWidth, height: expectedHeight })
  })

  it.each([
    [1303, 1303, 1302, 1302],
    [2048, 2048, 1302, 1302],
    [2048, 1024, 1848, 924],
    [3840, 2160, 1708, 961],
    [1080, 2400, 838, 1862],
  ])('downscales %sx%s to %sx%s at the solved long edge', (width, height, expectedWidth, expectedHeight) => {
    const sent = nuluRequestImageDimensions(width, height)
    expect(sent).toEqual({ width: expectedWidth, height: expectedHeight })
    expect(nuluImageTokens(sent.width, sent.height)).toBe(nuluImageTokens(width, height))
  })
})
