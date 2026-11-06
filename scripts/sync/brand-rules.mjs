/**
 * NULU BRANDING layer: the deterministic text and path rules that turn the upstream DeepSeek Harness tree into
 * Nulu Harness. Same input, same output; applying the rules to their own output changes nothing.
 *
 * BRAND_RULES_VERSION is recorded in every release manifest. Change it whenever a rule changes.
 */

export const BRAND_RULES_VERSION = '2026.11.06-1'

/** Files whose text is never rewritten: legal notices keep their owners' names, binary data stays byte-identical. */
export function brandExempt(path) {
  // Captured Session generations are historical inputs and stay byte-identical (see docs/session-format-status.md).
  return /(?:^|\/)session(?:\.\d+)?(?:\.v\d+)?\.jsonl(?:\.zstd)?$/.test(path)
    || /(?:^|\/)(?:LICENSE|NOTICE|COPYING)(?:\.[a-z]+)?$/i.test(path)
    || /(?:^|\/)THIRD_PARTY_NOTICES\.md$/.test(path)
    || /(?:^|\/)vendor\/[^/]+\/(?:LICENSE|README)/.test(path)
}

/** Upstream files Nulu does not ship: translation mirrors of English documents. */
export function retiredPath(path) {
  return /\.zh\.md$/.test(path) || /\.i18n\.yaml$/.test(path) || /(?:^|\/)README\.zh\.md$/.test(path)
}

/**
 * Ordered rules. Earlier, longer and more specific patterns run first so a later general rule never splits them.
 * Each entry is [pattern, replacement]; patterns are global regular expressions.
 */
export const RULES = [
  // Package and module names that Nulu renamed by role, not by brand.
  [/deepseek-llm-api-extensions/g, 'llm-api-extensions'],
  [/plugin-package-inventory-deepseek/g, 'plugin-package-inventory'],
  [/session-log-deepseek(?!\/delivery-accepted\b)/g, 'session-log-gateway'],
  [/web-search-deepseek/g, 'web-search-gateway'],
  [/llm-deepseek/g, 'llm-gateway'],
  [/SessionLogDeepSeek/g, 'SessionLogGateway'],
  [/LlmDeepSeek/g, 'LlmGateway'],
  [/llmDeepSeek/g, 'llmGateway'],
  // Provider route and model identifiers.
  [/deepseek-official/g, 'worldapp-gateway'],
  [/deepseek-v4-flash-vision-exp/g, 'nulu-5-vision'],
  [/deepseek-v4-flash/g, 'nulu-5'],
  [/deepseek-v4-pro/g, 'nulu-5-ultra'],
  [/deepseek-flash/g, 'nulu-5-ultra'],
  [/deepseek-chat/g, 'nulu-5'],
  // Scopes, endpoints and credentials.
  [/@deepseek-ai\/dsh/g, '@worldapptechnologies/nulu'],
  [/@deepseek-ai\//g, '@worldapptechnologies/'],
  [/https:\/\/api\.deepseek\.com\/anthropic/g, 'https://platform.worldapptechnologies.com/api'],
  [/https:\/\/api\.deepseek\.com/g, 'https://platform.worldapptechnologies.com/api/v1'],
  [/DEEPSEEK_HARNESS/g, 'NULU_HARNESS'],
  [/DEEPSEEK_/g, 'WORLD_APP_TECHNOLOGIES_'],
  // Product names.
  [/DeepSeek Harness/g, 'Nulu Harness'],
  [/DeepSeek harness/g, 'Nulu harness'],
  [/deepseek-harness/g, 'nulu-harness'],
  [/DeepSeekHarness/g, 'NuluHarness'],
  [/deepseek_harness/g, 'nulu_harness'],
  [/DeepSeek/g, 'Nulu'],
  [/deepSeek/g, 'nulu'],
  [/deepseek/g, 'nulu'],
  // The `dsh` command and its identifiers; `handshake` and similar words keep their letters.
  [/~\/\.dsh/g, '~/.nulu'],
  [/Dsh(?=[A-Z_]|\b)/g, 'Nulu'],
  [/DSH/g, 'NULU'],
  [/(?<![A-Za-z])dsh(?![a-z])/g, 'nulu'],
]

/**
 * Apply the rules to one text.
 * @param {string} text - file content or repository path.
 * @returns {string} branded text.
 */
export function brand(text) {
  let out = text
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement)
  return out
}
