// @vitest-environment jsdom
/**
 * The Spanish language pack inside the assembled web client: the shipped
 * web-app roster mounts it, the Settings Language row offers Español, and
 * selecting it switches real dictionaries and `<html lang>`.
 */
import { describe, expect, vi } from 'vitest'
import type {} from '@worldapptechnologies/nulu-client-ui-renderer/client'
import type { LanguageRowInjected, LanguageRowState } from '@worldapptechnologies/nulu-client-locale/client'
import { usePinnedBrowserLanguages } from '@worldapptechnologies/nulu-client-test-runtime'
import { ok } from '@worldapptechnologies/nulu-remote-mock'
import { createClientTest, type TestClient, webApp } from '@worldapptechnologies/nulu-client-test-runtime/src/assembly/index.ts'

const SELF = '@worldapptechnologies/nulu-client-ui-locale-es'
const it = createClientTest({ roster: webApp })
/** The whole roster's first boot pays the cold module transform of every plugin package. */
const COLD_BOOT_TIMEOUT_MS = 60_000

usePinnedBrowserLanguages('en-US')

/** Store-backed view of the Settings Language row, driven through its registered inject face. */
interface LanguageRowView {
  readonly state: () => LanguageRowState
  readonly face: LanguageRowInjected
}

function languageRow(c: TestClient): LanguageRowView {
  const entry = c.ctx.slots.entries('settings.general.item').find(row => row.options.id === 'language')
  if (entry === undefined) throw new Error('the Language row is not registered')
  const seats = entry as unknown as {
    store: { create(): { actions: unknown; getSnapshot(): LanguageRowState } }
    inject: (actions: unknown) => LanguageRowInjected
  }
  const store = seats.store.create()
  const face = seats.inject(store.actions)
  return { state: () => store.getSnapshot(), face }
}

describe('Spanish language pack in the web-app roster', () => {
  it('is a browser row of the shipped web profile', () => {
    expect(webApp.rows.map(row => row.name)).toContain(SELF)
  })

  it('lists Español in the Settings Language row and switches the UI to Spanish', async ({ mock, start }) => {
    mock.remote.settings.mutate.mockResolvedValue(ok({
      ns: 'locale', schema: {}, value: { preference: 'es' }, applies: 'live' as const, secrets: [], revision: 1,
    }))
    const c = await start()
    const row = languageRow(c)
    await vi.waitFor(() => {
      expect(row.state().options).toContainEqual({ id: 'es', label: 'Español' })
    })
    expect(row.state().active).toBe('en')

    row.face.setLocale('es')
    await vi.waitFor(() => { expect(row.state().active).toBe('es') })
    expect(document.documentElement.lang).toBe('es')
    await vi.waitFor(() => {
      expect(mock.log.calls('settings/mutate').map(call => call.args.slice(0, 2)))
        .toEqual([['locale', [{ op: 'set', path: ['preference'], value: 'es' }]]])
    })
    expect(c.ctx.locale.bind('settings.locale')('language.title')).toBe('Idioma')
    expect(c.ctx.locale.bind('settings')('title')).toBe('Configuración')
    // An untranslated key in a translated namespace renders the English text.
    expect(c.ctx.locale.bind('command')('token.plan')).toBe('plan')
  }, COLD_BOOT_TIMEOUT_MS)
})
