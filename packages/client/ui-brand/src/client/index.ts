/** Nulu Harness occupants for the generic browser-brand slots. */
import type { Context as ClientContext } from '@worldapptechnologies/cordis'
import type {} from '@worldapptechnologies/nulu-client-ui-renderer/client'
import type {} from '@worldapptechnologies/nulu-client-ui-sidebar/client'
import { NuluBrandMark, NuluBrandName } from './Brand.tsx'

/** Required service: the UI slot registry. */
export const inject = ['slots']

/**
 * Fill the sidebar brand slots as one declaration-aware registration set. The
 * conversation hero stays on its declaring package's mark, so this package
 * registers nothing there. Local builds keep the sidebar's local-build
 * fallback, matching the official-profile gate the replaced package owned.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  if (process.env.NULU_CLIENT_BUILD_PROFILE !== 'official') return
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register({ name: 'sidebar.brand.mark' }, NuluBrandMark)
      yield ctx.slots.register({ name: 'sidebar.brand.name' }, NuluBrandName)
    }))
}
