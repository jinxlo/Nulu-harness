import { describe, expect, it } from 'vitest'

import {
  isForbiddenModel,
  isForbiddenModelName,
  isForbiddenProvider,
  withoutForbiddenModels,
} from '../src/client/forbidden.ts'

describe('whitelabel model guard', () => {
  it('flags provider-branded names case-insensitively', () => {
    expect(isForbiddenModelName('deepseek-chat')).toBe(true)
    expect(isForbiddenModelName('DeepSeek Reasoner')).toBe(true)
    expect(isForbiddenModelName('nulu-5-ultra')).toBe(false)
    expect(isForbiddenModelName(undefined)).toBe(false)
  })

  it('flags records by id, name, provider or model field', () => {
    expect(isForbiddenModel({ id: 'deepseek-reasoner' })).toBe(true)
    expect(isForbiddenModel({ name: 'DeepSeek Chat' })).toBe(true)
    expect(isForbiddenModel({ provider: 'deepseek' })).toBe(true)
    expect(isForbiddenModel({ id: 'nulu-5-pro', provider: 'worldapp-gateway' })).toBe(false)
  })

  it('flags provider identifiers', () => {
    expect(isForbiddenProvider('deepseek')).toBe(true)
    expect(isForbiddenProvider('worldapp-gateway')).toBe(false)
  })

  it('removes forbidden entries without touching the rest', () => {
    const models = [
      { id: 'nulu-5-ultra' },
      { id: 'deepseek-chat' },
      { id: 'nulu-5-pro' },
      { name: 'DeepSeek Reasoner' },
    ]
    expect(withoutForbiddenModels(models)).toEqual([{ id: 'nulu-5-ultra' }, { id: 'nulu-5-pro' }])
  })
})
