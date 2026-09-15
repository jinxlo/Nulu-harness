/** Sign final native runtime files before the enclosing Desktop application is signed. */

import { createHash } from 'node:crypto'
import { closeSync, openSync, readSync } from 'node:fs'
import { join } from 'node:path'
import { inventoryDesktopRuntime } from '../src/runtime-tree.ts'
import type { MacOSSigningEnvironment } from './desktop-release-environment.mjs'
import {
  signMacOSRuntimeCode,
  signMacOSRuntimeCodeAdhoc,
  verifyAdhocMacOSRuntimeCode,
  verifyMacOSRuntimeCode,
} from './verify-macos-signature.mjs'

const MACH_O_MAGICS = new Set(['cafebabe', 'cafebabf', 'cefaedfe', 'cffaedfe', 'feedface', 'feedfacf', 'bebafeca', 'bfbafeca'])

function isMachO(path: string): boolean {
  const descriptor = openSync(path, 'r')
  try {
    const header = Buffer.alloc(4)
    return readSync(descriptor, header, 0, 4, 0) === 4 && MACH_O_MAGICS.has(header.toString('hex'))
  } finally { closeSync(descriptor) }
}

async function signMacOSRuntimeFiles(
  root: string,
  appId: string,
  sign: (path: string, identifier: string) => Promise<void>,
  verify: (path: string) => void,
): Promise<number> {
  const files = inventoryDesktopRuntime(root).map(file => file.path).filter(path => isMachO(join(root, path)))
  let next = 0
  const workers = Array.from({ length: Math.min(4, files.length) }, async () => {
    for (;;) {
      const path = files[next++]
      if (path === undefined) return
      const identifier = `${appId}.runtime.${createHash('sha256').update(path).digest('hex')}`
      await sign(join(root, path), identifier)
      verify(join(root, path))
    }
  })
  const results = await Promise.allSettled(workers)
  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason as unknown)
  if (errors.length > 0) throw new AggregateError(errors, 'desktop runtime: native signing failed')
  return files.length
}

/**
 * Sign and verify every materialized Mach-O file, awaiting all signers on failure.
 * @param root - Self-contained production runtime without symlinks.
 * @param appId - Release application identifier.
 * @param expected - Required signing identity.
 * @returns Number of signed native files.
 */
export function signMacOSRuntime(root: string, appId: string, expected: MacOSSigningEnvironment): Promise<number> {
  return signMacOSRuntimeFiles(
    root,
    appId,
    (path, identifier) => signMacOSRuntimeCode(path, identifier, expected),
    path => verifyMacOSRuntimeCode(path, expected),
  )
}

/**
 * Ad-hoc sign and verify every materialized Mach-O file for an unsigned build.
 * @param root - Self-contained production runtime without symlinks.
 * @param appId - Release application identifier.
 * @returns Number of signed native files.
 */
export function adhocSignMacOSRuntime(root: string, appId: string): Promise<number> {
  return signMacOSRuntimeFiles(
    root,
    appId,
    (path, identifier) => signMacOSRuntimeCodeAdhoc(path, identifier),
    path => verifyAdhocMacOSRuntimeCode(path),
  )
}
