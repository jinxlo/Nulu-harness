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

export function validateModelPolicy(gateway, bundle, allowed) {
  const ids = gatewayModelIds(gateway)
  if (ids.length === 0 || ids.some(id => !allowed.includes(id))) throw new Error('Default gateway catalog contains a forbidden model')
  const patches = load(bundle, { schema: profileSchema })
  const rows = patches.flatMap(patch => patch.insert ?? [])
  const providers = rows.find(row => row.id === 'llm-pi-ai')?.config?.providers
  if (!providers || Object.keys(providers).some(route => route !== 'worldapp')) throw new Error('Default provider configuration must contain only worldapp')
  const route = providers.worldapp
  if (route.baseURL !== 'https://platform.worldapptechnologies.com/api/v1' || route.apiKeyEnv !== 'WORLD_APP_TECHNOLOGIES_API_KEY'
    || !Array.isArray(route.models) || route.models.length === 0 || route.models.some(model => !allowed.includes(model.id))) throw new Error('Default Nulu API or model configuration changed')
  return true
}
