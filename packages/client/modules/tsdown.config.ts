import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(
  '@worldapptechnologies/nulu-client-modules',
  ['lib/types/index.js', 'lib/types/invariant.js'],
)
