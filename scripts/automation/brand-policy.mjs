/** Parse configured model declarations; unfamiliar source forms fail closed instead of hiding IDs. */
import ts from 'typescript'
import { DEFAULT_SCHEMA, load, Type } from 'js-yaml'

// Profile expressions are inert strings here; policy validation never evaluates them.
const profileSchema = DEFAULT_SCHEMA.extend(new Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: value => value }))

export function gatewayModelIds(source) {
  const tree = ts.createSourceFile('gateway.ts', source, ts.ScriptTarget.Latest, true)
  let initializer
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'DEFAULT_MODELS') initializer = node.initializer
    ts.forEachChild(node, visit)
  }
  visit(tree)
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) throw new Error('DEFAULT_MODELS must be an explicit model array')
  return initializer.elements.map(model => {
    if (!ts.isObjectLiteralExpression(model)) throw new Error('Every default model must be explicit')
    const id = model.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(tree).replace(/^['"]|['"]$/g, '') === 'id')
    if (!id || !ts.isStringLiteralLike(id.initializer)) throw new Error('Every default model requires a literal id')
    return id.initializer.text
  })
}

const NULU_API_URL = 'https://platform.worldapptechnologies.com/api/v1'
const NULU_API_KEY_ENV = 'WORLD_APP_TECHNOLOGIES_API_KEY'

/**
 * The shipped composition serves Nulu models through one route: the native gateway `worldapp-gateway`, whose
 * catalog holds only allowed ids, whose endpoint and key variable are the Nulu API's, and which the default model
 * names. The pi-ai adapter stays dormant, so no second route lists the same models.
 */
export function validateModelPolicy(gateway, bundle, allowed, gatewayConfig) {
  const ids = gatewayModelIds(gateway)
  if (ids.length === 0 || ids.some(id => !allowed.includes(id))) throw new Error('Default gateway catalog contains a forbidden model')
  if (!gatewayConfig.includes(`PUBLIC_BASE_URL = '${NULU_API_URL}'`) || !gatewayConfig.includes(`DEFAULT_API_KEY_ENV = '${NULU_API_KEY_ENV}'`)) throw new Error('Default Nulu API or model configuration changed')
  const patches = load(bundle, { schema: profileSchema })
  const rows = patches.flatMap(patch => patch.insert ?? [])
  if (!rows.some(row => row.id === 'llm-gateway')) throw new Error('The base composition must mount the native Nulu gateway')
  const piProviders = rows.find(row => row.id === 'llm-pi-ai')?.config?.providers
  if (piProviders && Object.keys(piProviders).length > 0) throw new Error('The pi-ai adapter must ship without provider profiles; Nulu models are served by worldapp-gateway only')
  const selection = rows.find(row => row.id === 'agent-default-model')?.config
  if (selection?.provider !== 'worldapp-gateway' || !allowed.includes(selection.model)) throw new Error('The default model must be an allowed Nulu model on worldapp-gateway')
  return true
}
