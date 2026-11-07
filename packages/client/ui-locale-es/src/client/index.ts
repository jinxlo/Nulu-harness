/**
 * Spanish language pack for the Web client. Adds Español to the locale
 * catalog with English as its fallback and registers one Spanish dictionary
 * per translated namespace; any key or namespace without a Spanish entry
 * renders its English text.
 */
import type { Context as ClientContext } from '@worldapptechnologies/cordis'
// Type-only: pulls the ctx.locale service merge.
import type {} from '@worldapptechnologies/nulu-client-locale/client'
import { dictionaries, language } from './locales/index.ts'

/** Required service: the locale registry. */
export const inject = ['locale']

/**
 * Register the Spanish language definition and its dictionaries as owned
 * effects; disposing the plugin removes Español from the selector and every
 * Spanish dictionary.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.locale.addLanguage(language),
    'ui-locale-es: language',
  )
  for (const [namespace, dictionary] of Object.entries(dictionaries)) {
    ctx.effect(
      () => ctx.locale.register(namespace, 'es', dictionary),
      `ui-locale-es: ${namespace} dictionary`,
    )
  }
}
