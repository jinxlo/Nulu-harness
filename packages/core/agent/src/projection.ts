import type { TurnBoundaryProjection } from './types.ts'
import type {} from '@worldapptechnologies/nulu-session-projection'

declare module '@worldapptechnologies/nulu-session-projection/types' {
  interface SessionProjectionStateMap {
    /** The agent session's open/last turn and step boundary facts (whole value). */
    turnBoundary: TurnBoundaryProjection
  }
}

export {}
