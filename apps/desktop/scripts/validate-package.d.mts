/** Package-layout facts used to validate one built desktop artifact. */
export interface ValidatePackagedResourcesInput {
  readonly outputDir: string
  readonly platform: NodeJS.Platform
  readonly unsigned: boolean
}

/**
 * Assert that every mandatory runtime resource is present in the packaged artifact.
 * @param input - Package layout facts.
 * @throws {Error} when any mandatory resource is absent.
 */
export function validatePackagedResources(input: ValidatePackagedResourcesInput): void
