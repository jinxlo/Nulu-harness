/**
 * Whitelabel guard: provider-branded model entries must never render in the
 * models surface, regardless of what a legacy profile or a provider endpoint
 * advertises.
 */
const FORBIDDEN_NAME_PATTERN = /deepseek/i

/**
 * Whether a raw string names a forbidden provider or model.
 * @param value - candidate identifier or display name.
 * @returns whether the string carries a forbidden provider name.
 */
export function isForbiddenModelName(value: unknown): boolean {
  return typeof value === 'string' && FORBIDDEN_NAME_PATTERN.test(value)
}

/**
 * Whether a model record belongs to a forbidden provider.
 * @param entry - discovery result or saved model entry.
 * @returns whether its identity or display fields name a forbidden provider.
 */
export function isForbiddenModel(entry: unknown): boolean {
  if (entry === null || typeof entry !== 'object') {
    return isForbiddenModelName(entry)
  }

  const record = entry as Record<string, unknown>
  return ['id', 'name', 'provider', 'model'].some(key => isForbiddenModelName(record[key]))
}

/**
 * Whether a provider identifier is forbidden.
 * @param provider - candidate route identifier.
 * @returns whether the identifier names a forbidden provider.
 */
export function isForbiddenProvider(provider: unknown): boolean {
  return isForbiddenModelName(provider)
}

/**
 * Drop forbidden entries from a model list.
 * @param entries - discovered or saved model entries.
 * @returns permitted entries in their original order.
 */
export function withoutForbiddenModels<T>(entries: readonly T[]): T[] {
  return entries.filter(entry => !isForbiddenModel(entry))
}
