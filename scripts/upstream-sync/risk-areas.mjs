/**
 * Foundational architecture areas the Nulu fork depends on, and the upstream
 * paths that touch each area.
 *
 * This is the risk map used by risk-detect.mjs. It is deliberately declarative
 * so the framework stays general: adding a new protected area is a data change,
 * not a code change.
 *
 * Each area declares:
 *   - patterns:      upstream paths that touch this area
 *   - nuluProtected: Nulu files that depend on this area (from the fork manifest)
 *   - reason:        why a change here is high risk for Nulu
 */

export const RISK_AREAS = [
  {
    area: 'provider-registry',
    patterns: [
      /^packages\/llm\/llm\/src\/index\.ts$/,
      /^packages\/llm\/llm-pi-ai\/src\/catalog\.ts$/,
      /^packages\/llm\/llm-pi-ai\/src\/index\.ts$/,
      /^packages\/llm\/llm-gateway\/src\/index\.ts$/,
      /^packages\/llm\/llm-pi-ai\/src\/config\.ts$/,
    ],
    nuluProtected: [
      'packages/llm/llm-pi-ai/src/catalog.ts',
      'packages/llm/llm-gateway/src/index.ts',
    ],
    reason: 'Nulu replaces upstream provider discovery with the World App Technologies provider and an API-driven model catalog.',
  },
  {
    area: 'model-discovery',
    patterns: [
      /^packages\/llm\/llm-pi-ai\/src\/discovery\.ts$/,
      /^packages\/llm\/llm\/src\/index\.ts$/,
    ],
    nuluProtected: ['packages/llm/llm-pi-ai/src/catalog.ts'],
    reason: 'Nulu model catalog is supplied by the World App Technologies API, never by upstream discovery.',
  },
  {
    area: 'llm-abstraction',
    patterns: [/^packages\/llm\/llm\/src\//, /^packages\/llm\/llm-api-extensions\/src\//],
    nuluProtected: ['packages/llm/llm-gateway/src/index.ts'],
    reason: 'The Nulu adapter extends the LLM abstraction; upstream API changes must be re-integrated, not copied.',
  },
  {
    area: 'agent-runtime',
    patterns: [/^packages\/core\/agent\//, /^packages\/core\/agent-.*\//],
    nuluProtected: [],
    reason: 'Core agent behavior is shared; changes must preserve Nulu product behavior.',
  },
  {
    area: 'tool-execution',
    patterns: [/^packages\/extensions\/tool-/, /^packages\/tool\//, /^packages\/core\/tool/],
    nuluProtected: [],
    reason: 'Tool execution is generic but interacts with the Nulu toolset.',
  },
  {
    area: 'session-management',
    patterns: [/^packages\/core\/session\//, /^packages\/api\/session-controller\//, /^packages\/session\//],
    nuluProtected: [],
    reason: 'Session behavior is shared; changes must preserve Nulu session persistence.',
  },
  {
    area: 'configuration',
    patterns: [/^packages\/core\/settings\//, /^packages\/bundle\/base\/cordis\.patch\.yml$/, /^packages\/bundle\//],
    nuluProtected: ['packages/bundle/base/cordis.patch.yml', 'packages/bundle/acp-app/cordis.patch.yml'],
    reason: 'The base bundle encodes the World App provider and Nulu model defaults.',
  },
  {
    area: 'plugin-architecture',
    patterns: [/^packages\/cordis\//, /^packages\/plugin\//],
    nuluProtected: [],
    reason: 'The Cordis plugin kernel is foundational to the harness.',
  },
  {
    area: 'tui',
    patterns: [/^apps\/cli\//, /^packages\/client\/ui-model-selection\//, /^packages\/client\/ui-settings-models\//],
    nuluProtected: [
      'packages/client/ui-model-selection/src/client/index.ts',
      'packages/client/ui-model-selection/src/client/locales.ts',
    ],
    reason: 'Nulu owns the model-selector and settings UI; upstream TUI changes must preserve it.',
  },
  {
    area: 'authentication',
    patterns: [/^packages\/auth\//, /^packages\/core\/credentials\//, /^packages\/llm\/llm-pi-ai\/src\/login\.ts$/],
    nuluProtected: [],
    reason: 'Credential handling is shared; Nulu uses the World App API key.',
  },
  {
    area: 'api-routing',
    patterns: [/^packages\/api\//, /^packages\/acp\//],
    nuluProtected: [],
    reason: 'API routing is shared.',
  },
  {
    area: 'desktop-runtime',
    patterns: [/^apps\/desktop\//],
    nuluProtected: [
      'apps/desktop/src/github-update-check.ts',
      'apps/desktop/src/main.ts',
      'apps/desktop/src/locale.ts',
    ],
    reason: 'Nulu owns the desktop distribution and GitHub update check.',
  },
  {
    area: 'package-boundaries',
    patterns: [/^pnpm-workspace\.ya?ml$/, /^package\.json$/, /^tsconfig/],
    nuluProtected: [],
    reason: 'Package scope is @worldapptechnologies/*; upstream scope changes must be rebranded.',
  },
  {
    area: 'state-persistence',
    patterns: [/^packages\/session\//, /^packages\/core\/session-.*\//],
    nuluProtected: [],
    reason: 'State persistence is shared.',
  },
]

export function areasForPaths(paths) {
  const matches = []
  for (const area of RISK_AREAS) {
    if (paths.some(path => area.patterns.some(pattern => pattern.test(path)))) {
      matches.push(area.area)
    }
  }
  return matches
}

export function areaByName(name) {
  return RISK_AREAS.find(area => area.area === name)
}
