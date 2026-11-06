/** Pack the nulu-harness npm package for one exact Nulu Harness version; the workspace manifest keeps a placeholder. */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT, command, json } from './common.mjs'

/**
 * Write the package with its version and its launcher dependency pinned to the same release, then pack it.
 * @param out - directory that receives the tarball.
 * @param version - Nulu Harness version; defaults to the repository version.
 * @returns the tarball path.
 */
export function packDistribution(out, version = json('package.json').version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('The nulu-harness package requires a stable version')
  const source = join(ROOT, 'distribution/nulu-harness')
  const staging = mkdtempSync(join(tmpdir(), 'nulu-harness-pack-'))
  try {
    cpSync(source, staging, { recursive: true })
    const manifest = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
    manifest.version = version
    // Exact pin: the command and the runtime it starts are qualified together as one release.
    manifest.dependencies['@worldapptechnologies/nulu'] = version
    writeFileSync(join(staging, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    mkdirSync(out, { recursive: true })
    const [{ filename }] = JSON.parse(command('npm', ['pack', '--json', '--pack-destination', resolve(out)], { cwd: staging }))
    return join(resolve(out), filename)
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [out, version] = process.argv.slice(2)
  if (!out) throw new Error('Usage: pack-distribution.mjs <output-directory> [version]')
  console.log(packDistribution(out, version))
}
