/** Wire types for the active Nulu plugin package inventory. */

/** One exact active plugin package version. */
export interface NuluPluginPackageIdentity {
  readonly name: string
  readonly version: string
}

/** Versioned full package inventory carried by each official Nulu request. */
export interface NuluPluginPackageInventoryExtension {
  readonly version: 1
  readonly packages: readonly NuluPluginPackageIdentity[]
}

declare module '@worldapptechnologies/nulu-llm-api-extensions/types' {
  interface NuluLlmApiExtensionMap {
    nulu_plugin_packages: NuluPluginPackageInventoryExtension
  }
}
