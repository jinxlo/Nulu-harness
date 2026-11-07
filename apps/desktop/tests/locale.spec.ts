import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { en, es, formatDesktopMessage, resolveDesktopLocale, zh } from '../src/locale.ts'

describe('desktop locale dictionaries', () => {
  it('ships the same key set in English, Chinese, and Spanish', () => {
    expect(Object.keys(zh)).toEqual(Object.keys(en))
    expect(Object.keys(es)).toEqual(Object.keys(en))
    expect(resolveDesktopLocale('zh-Hans-CN')).toEqual({ id: 'zh-CN', messages: zh })
    expect(resolveDesktopLocale('en-US')).toEqual({ id: 'en', messages: en })
    expect(resolveDesktopLocale('es-419')).toEqual({ id: 'es', messages: es })
    expect(resolveDesktopLocale('es')).toEqual({ id: 'es', messages: es })
    expect(resolveDesktopLocale('fr-FR')).toEqual({ id: 'en', messages: en })
  })

  it('keeps every English placeholder in the Spanish copy', () => {
    const names = (message: string) => [...message.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()
    for (const key of Object.keys(en) as (keyof typeof en)[]) expect(names(es[key])).toEqual(names(en[key]))
  })

  it('formats named values without consuming unknown placeholders', () => {
    expect(formatDesktopMessage('{name}@{version} {missing}', { name: 'plugin', version: '1.2.3' }))
      .toBe('plugin@1.2.3 {missing}')
  })

  it('keeps visible plugin-manager HTML copy in the locale dictionaries', () => {
    const html = readFileSync(new URL('../renderer/plugin-manager.html', import.meta.url), 'utf8')
    const staticText = [...html.matchAll(/>([^<]*\p{L}[^<]*)</gu)].map(match => match[1]?.trim())
    expect(staticText).toEqual([])
  })
})
