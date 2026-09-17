import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@worldapptechnologies/nulu-api-terminal-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)
