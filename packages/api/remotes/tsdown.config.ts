import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@worldapptechnologies/nulu-api-remotes',
  ['lib/types/index.js'],
  { hostPhase: true },
)
