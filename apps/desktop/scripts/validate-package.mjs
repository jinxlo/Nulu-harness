/** Fail a desktop package build when mandatory runtime resources are absent from the artifact. */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Resources every packaged desktop application must carry on disk. */
function requiredResources(platform) {
  return [
    'nulu/desktop-runtime.json',
    'nulu/node_modules',
    'runtime/versions.json',
    platform === 'win32' ? 'runtime/node/node.exe' : 'runtime/node/node',
    'runtime/pnpm',
    'app.asar',
  ]
}

/**
 * Locate the packaged resources directory for one target.
 * @param outputDir - electron-builder output directory for the target.
 * @param platform - Target Node platform.
 * @returns Absolute path to the packaged resources directory.
 */
function resourcesRoot(outputDir, platform) {
  if (platform === 'win32') return join(outputDir, 'win-unpacked', 'resources')
  if (platform === 'linux') return join(outputDir, 'linux-unpacked', 'resources')
  const candidates = [
    join(outputDir, 'mac-arm64', 'Nulu Harness.app', 'Contents', 'Resources'),
    join(outputDir, 'mac', 'Nulu Harness.app', 'Contents', 'Resources'),
  ]
  return candidates.find(candidate => existsSync(candidate)) ?? candidates[0]
}

/**
 * Assert that every mandatory runtime resource is present in the packaged artifact.
 * The runtime descriptor's own file list is verified too, so a partial copy fails
 * before an installer is published.
 * @param input - Package layout facts.
 */
export function validatePackagedResources({ outputDir, platform, unsigned }) {
  const root = resourcesRoot(outputDir, platform)
  if (!existsSync(root)) {
    throw new Error(`desktop package validation: no packaged resources at ${root}`)
  }

  const missing = []
  for (const relative of requiredResources(platform)) {
    if (!existsSync(join(root, relative))) missing.push(relative)
  }
  if (!unsigned && !existsSync(join(root, 'app-update.yml'))) missing.push('app-update.yml')

  const descriptorRelative = 'nulu/desktop-runtime.json'
  if (!missing.includes(descriptorRelative)) {
    try {
      const descriptor = JSON.parse(readFileSync(join(root, descriptorRelative), 'utf8'))
      const files = Array.isArray(descriptor.files) ? descriptor.files : []
      if (files.length === 0) missing.push(`${descriptorRelative} (empty file list)`)
      for (const entry of files) {
        const path = entry !== null && typeof entry === 'object' ? entry.path : undefined
        if (typeof path !== 'string' || path === '') {
          missing.push(`${descriptorRelative} (malformed entry)`)
          break
        }
        if (!existsSync(join(root, 'nulu', ...path.split('/')))) {
          missing.push(`nulu/${path}`)
          if (missing.length > 25) break
        }
      }
    } catch (error) {
      missing.push(`${descriptorRelative} (${error instanceof Error ? error.message : String(error)})`)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      'desktop package validation: missing mandatory runtime resources:\n  '
      + missing.join('\n  '),
    )
  }

  console.log(`desktop package validation: ${root} carries every mandatory runtime resource`)
}
