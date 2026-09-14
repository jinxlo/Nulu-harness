import { BrandWordmark, NuluMark } from '@worldapptechnologies/nulu-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps } from '@worldapptechnologies/nulu-client-ui-sidebar/client'

/**
 * Render the Nulu mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the Nulu mark.
 */
export function NuluBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return <NuluMark size={size} />
}

/**
 * Render the Nulu name artwork without its independently slotted mark.
 * @returns the Nulu name wordmark.
 */
export function NuluBrandName() {
  return <BrandWordmark includeMark={false} />
}
