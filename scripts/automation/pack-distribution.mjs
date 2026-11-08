/**
 * Pack the nulu-harness npm package for one exact Nulu Harness version as a single published package.
 *
 * Every package of the nulu release family ships inside the tarball under runtime/node_modules, so a version is
 * one npm publication. Packages from other publishers stay ordinary dependencies: npm installs them on the
 * customer's machine and picks the build for that operating system and processor. Node resolves a family
 * package's imports in runtime/node_modules first, then in the node_modules npm installed above it.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT, command, json } from './common.mjs'

/**
 * Read the manifest packed in an npm tarball.
 * @param tarball - tarball path.
 * @returns the parsed package.json.
 */
function packedManifest(tarball) {
  return JSON.parse(command('tar', ['-xzf', tarball, '-O', 'package/package.json']))
}

/**
 * Order key of a range's lowest version, for ranges written as `x.y.z`, `^x.y.z` or `~x.y.z`.
 * @param range - an npm version range.
 * @returns numbers to compare, or an empty list for other range forms.
 */
function rangeFloor(range) {
  const match = /^[\^~]?(\d+)\.(\d+)\.(\d+)/.exec(range)
  return match ? match.slice(1).map(Number) : []
}

/**
 * Pick the top-level range for one external dependency: the major line most family packages ask for, then its
 * highest floor. npm nests another copy for a package whose range that version does not satisfy.
 * @param ranges - each requesting package's range.
 * @returns the range written into the nulu-harness manifest.
 */
export function rootRange(ranges) {
  const byMajor = new Map()
  for (const range of ranges) {
    const major = rangeFloor(range)[0] ?? range
    byMajor.set(major, [...byMajor.get(major) ?? [], range])
  }
  const [, line] = [...byMajor].sort((a, b) => b[1].length - a[1].length || String(b[0]).localeCompare(String(a[0]), 'en', { numeric: true }))[0]
  return line.sort((a, b) => {
    const [x, y] = [rangeFloor(a), rangeFloor(b)]
    for (let index = 0; index < 3; index += 1) if ((y[index] ?? 0) !== (x[index] ?? 0)) return (y[index] ?? 0) - (x[index] ?? 0)
    // At an equal floor the exact version satisfies every caret or tilde range that shares it.
    return Number(/^\d/.test(b)) - Number(/^\d/.test(a)) || a.localeCompare(b)
  })[0]
}

/**
 * Whether the version npm installs for `root` always satisfies `range`, for ranges written as `x.y.z`,
 * `^x.y.z` or `~x.y.z` with a major version above 0.
 * @param root - the top-level range.
 * @param range - a family package's range.
 * @returns true when the family package can use the top-level copy.
 */
export function covers(root, range) {
  if (root === range) return true
  const [r, c] = [rangeFloor(root), rangeFloor(range)]
  if (r.length === 0 || c.length === 0 || r[0] === 0 || r[0] !== c[0]) return false
  const exact = value => /^\d/.test(value)
  if (exact(range)) return exact(root) && r.join('.') === c.join('.')
  if (range.startsWith('~') && (root.startsWith('^') || r[1] !== c[1])) return false
  for (let index = 0; index < 3; index += 1) if (r[index] !== c[index]) return r[index] > c[index]
  return true
}

/**
 * Compute the nulu-harness dependencies from the family manifests.
 * @param manifests - the packed family manifests.
 * @param version - the release version every family package carries.
 * @returns top-level external `dependencies`, and the `nested` external ranges a family package needs in its
 * own node_modules because the top-level copy does not satisfy them.
 */
export function distributionDependencies(manifests, version) {
  const family = new Set(manifests.map(manifest => manifest.name))
  if (!family.has('@worldapptechnologies/nulu')) throw new Error('The release family does not contain @worldapptechnologies/nulu')
  const requests = []
  for (const manifest of manifests) {
    if (manifest.version !== version) throw new Error(`${manifest.name}@${manifest.version} is not part of release ${version}`)
    if (manifest.optionalDependencies && Object.keys(manifest.optionalDependencies).length > 0) throw new Error(`${manifest.name} has optional dependencies, which this package format does not carry`)
    const optionalPeers = manifest.peerDependenciesMeta ?? {}
    const required = {
      ...manifest.dependencies,
      ...Object.fromEntries(Object.entries(manifest.peerDependencies ?? {}).filter(([name]) => optionalPeers[name]?.optional !== true)),
    }
    for (const [name, range] of Object.entries(required)) {
      if (family.has(name)) {
        if (range !== version && range !== `^${version}` && range !== `~${version}` && range !== 'workspace:*') throw new Error(`${manifest.name} asks for ${name}@${range}, not release ${version}`)
        continue
      }
      requests.push({ consumer: manifest.name, name, range })
    }
  }
  const ranges = new Map()
  for (const { name, range } of requests) ranges.set(name, [...ranges.get(name) ?? [], range])
  const dependencies = Object.fromEntries([...ranges].sort(([a], [b]) => a.localeCompare(b)).map(([name, list]) => [name, rootRange(list)]))
  const nested = requests.filter(({ name, range }) => !covers(dependencies[name], range))
  return { dependencies, nested }
}

/**
 * Pack nulu-harness with the family tarballs from `familyDirectory` inside it, under `runtime/node_modules`.
 * @param out - directory that receives the tarball.
 * @param familyDirectory - directory holding the packed nulu release family.
 * @param version - Nulu Harness version; defaults to the repository version.
 * @returns the tarball path.
 */
export function packDistribution(out, familyDirectory, version = json('package.json').version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('The nulu-harness package requires a stable version')
  const tarballs = readdirSync(resolve(familyDirectory)).filter(name => name.endsWith('.tgz')).map(name => resolve(familyDirectory, name))
  const manifests = tarballs.map(packedManifest)
  const { dependencies, nested } = distributionDependencies(manifests, version)
  const work = mkdtempSync(join(tmpdir(), 'nulu-harness-pack-'))
  const staging = join(work, 'package')
  const runtime = join(staging, 'runtime/node_modules')
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/KEY|TOKEN|SECRET|PASSWORD|^npm_config_/i.test(name)))
  try {
    cpSync(join(ROOT, 'distribution/nulu-harness'), staging, { recursive: true })
    for (const [index, tarball] of tarballs.entries()) {
      const target = join(runtime, manifests[index].name)
      mkdirSync(target, { recursive: true })
      command('tar', ['-xzf', tarball, '-C', target, '--strip-components=1'])
    }
    for (const { consumer, name, range } of nested) {
      // A family package whose range the top-level copy does not satisfy gets its own copy, as npm would nest it.
      const scratch = join(work, 'nested', `${consumer}+${name}`.replace(/[@/]/g, '_'))
      mkdirSync(scratch, { recursive: true })
      writeFileSync(join(scratch, 'package.json'), '{"private":true}\n')
      // Peers stay unresolved here: the consumer reaches the single top-level copy of each peer.
      command('npm', ['install', `${name}@${range}`, '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund', '--no-package-lock', '--loglevel=error'], { cwd: scratch, env })
      requirePortable(join(scratch, 'node_modules'), `${name}@${range} for ${consumer}`)
      cpSync(join(scratch, 'node_modules'), join(runtime, consumer, 'node_modules'), { recursive: true })
      rmSync(join(runtime, consumer, 'node_modules', '.package-lock.json'), { force: true })
    }
    const manifest = JSON.parse(readFileSync(join(staging, 'package.json'), 'utf8'))
    manifest.version = version
    manifest.dependencies = dependencies
    manifest.files = [...manifest.files, 'runtime']
    writeFileSync(join(staging, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
    mkdirSync(resolve(out), { recursive: true })
    const [{ filename }] = JSON.parse(command('npm', ['pack', '--json', '--pack-destination', resolve(out)], { cwd: staging, env }))
    const tarball = join(resolve(out), filename)
    verifyPacked(tarball, manifests.map(m => m.name))
    return tarball
  } finally {
    rmSync(work, { recursive: true, force: true, maxRetries: 3 })
  }
}

/**
 * Fail when an installed tree holds anything built for one platform: an os or cpu restriction, an install
 * script, a native addon build file, or a compiled `.node` addon.
 * @param directory - a node_modules directory.
 * @param label - what was installed, for the error.
 */
function requirePortable(directory, label) {
  const found = []
  const visit = path => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name)
      if (entry.isDirectory()) visit(child)
      else if (entry.name.endsWith('.node') || entry.name === 'binding.gyp') found.push(child)
      else if (entry.name === 'package.json') {
        const manifest = JSON.parse(readFileSync(child, 'utf8'))
        if (manifest.os || manifest.cpu || manifest.scripts?.install || manifest.scripts?.postinstall || manifest.scripts?.preinstall) found.push(child)
      }
    }
  }
  visit(directory)
  if (found.length > 0) throw new Error(`${label} is not platform independent: ${found.slice(0, 5).join(', ')}`)
}

/**
 * Fail unless the tarball carries every family package under runtime/node_modules and nothing in node_modules.
 * @param tarball - the packed nulu-harness tarball.
 * @param family - family package names.
 */
function verifyPacked(tarball, family) {
  const entries = command('tar', ['-tzf', tarball], { maxBuffer: 256 * 1024 * 1024 }).split('\n')
  const present = new Set(entries)
  const missing = family.filter(name => !present.has(`package/runtime/node_modules/${name}/package.json`))
  if (missing.length > 0) throw new Error(`nulu-harness does not carry ${missing.join(', ')}`)
  const installed = entries.filter(entry => entry.startsWith('package/node_modules/'))
  if (installed.length > 0) throw new Error(`nulu-harness must not carry top-level node_modules: ${installed.slice(0, 5).join(', ')}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [out, familyDirectory, version] = process.argv.slice(2)
  if (!out || !familyDirectory) throw new Error('Usage: pack-distribution.mjs <output-directory> <family-tarball-directory> [version]')
  console.log(packDistribution(out, familyDirectory, version))
}
