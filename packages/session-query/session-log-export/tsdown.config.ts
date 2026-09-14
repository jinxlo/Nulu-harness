import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@worldapptechnologies/nulu-session-log-export',
  ['lib/types/index.js'],
  { hostPhase: true },
)
