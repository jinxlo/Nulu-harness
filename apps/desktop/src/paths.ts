/** Filesystem ownership for the Electron-managed desktop installation. */

import { join } from 'node:path'
import { resolveDshHome } from '@worldapptechnologies/nulu-home-paths'

/** Stable desktop installation paths under the shared Harness home. */
export interface DesktopPaths {
  readonly root: string
  readonly profile: string
  readonly lock: string
  readonly pnpm: {
    readonly root: string
    readonly store: string
    readonly cache: string
    readonly state: string
    readonly config: string
    readonly home: string
  }
}

/**
 * Resolve every Electron-owned path without changing the shared data roots.
 * @param nuluHome - Harness home shared with npm-installed nulu.
 * @returns immutable desktop path set.
 */
export function resolveDesktopPaths(nuluHome: string = resolveDshHome()): DesktopPaths {
  const root = join(nuluHome, 'desktop')
  const pnpm = join(root, 'pnpm')
  return {
    root,
    profile: join(nuluHome, 'profiles', 'desktop'),
    lock: join(nuluHome, 'profiles', 'desktop', 'lock'),
    pnpm: {
      root: pnpm,
      store: join(pnpm, 'store'),
      cache: join(pnpm, 'cache'),
      state: join(pnpm, 'state'),
      config: join(pnpm, 'config'),
      home: join(pnpm, 'home'),
    },
  }
}
