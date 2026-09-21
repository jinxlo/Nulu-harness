/** Nulu Files API identifiers. @module nulu-llm-gateway/file-id */

import type { Branded } from '@worldapptechnologies/nulu-brand'

/** Opaque identifier returned by the Nulu Files API. */
export type NuluFileId = Branded<'NuluFileId'>

/**
 * Brand a provider-returned file identifier after wire validation.
 * @param id - non-empty Files API identifier.
 * @returns the same string with its provider identity attached at type level.
 */
export function NuluFileId(id: string): NuluFileId {
  return id as NuluFileId
}

/** Non-secret digest identifying one endpoint and API-key file namespace. */
export type NuluFileScope = Branded<'NuluFileScope'>

/**
 * Brand a locally derived namespace digest.
 * @param scope - SHA-256 digest of endpoint and API key.
 * @returns the same string with namespace identity attached at type level.
 */
export function NuluFileScope(scope: string): NuluFileScope {
  return scope as NuluFileScope
}
