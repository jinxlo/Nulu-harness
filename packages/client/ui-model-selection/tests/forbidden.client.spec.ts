import { describe, expect, it } from 'vitest'
import { isForbiddenModel, isForbiddenModelName } from '../src/client/forbidden.ts'

describe('model-selector branding guard', () => {
  it('blocks legacy primitive provider names and accepts Nulu names', () => {
    expect(isForbiddenModel('DeepSeek Chat')).toBe(true)
    expect(isForbiddenModel('nulu-5-ultra')).toBe(false)
    expect(isForbiddenModel(null)).toBe(false)
    expect(isForbiddenModelName(undefined)).toBe(false)
  })

  it('blocks provider branding in identity fields while preserving permitted model records', () => {
    for (const key of ['id', 'name', 'provider', 'model']) {
      expect(isForbiddenModel({ [key]: 'DeepSeek' })).toBe(true)
    }
    expect(isForbiddenModel({ id: 'nulu-5-ultra', name: 'Nulu 5 Ultra', provider: 'worldapp' })).toBe(false)
  })
})
