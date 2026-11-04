/** Qualify release assets and serialize the website's complete, versioned download catalog. */
import { createHash } from 'node:crypto'
import { createReadStream, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const TARGETS = ['win-x64', 'mac-arm64', 'mac-x64', 'linux-x64']

export function versionOrder(left, right) {
  for (const value of [left, right]) if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error('Expected stable release versions')
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

export function installerName(version, target) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !TARGETS.includes(target)) throw new Error('Invalid release version or target')
  const suffix = { 'win-x64': 'win-x64.exe', 'mac-arm64': 'mac-arm64.dmg', 'mac-x64': 'mac-x64.dmg', 'linux-x64': 'linux-x86_64.AppImage' }[target]
  return `nulu-harness-${version}-${suffix}`
}

export function validateNativeEvidence(evidence, target, version, source) {
  if (evidence?.schemaVersion !== 1 || evidence.target !== target || evidence.source !== source || evidence.version !== version
    || evidence.branding !== 'passed' || evidence.updateNotification !== 'passed' || evidence.packagedLaunch !== 'passed'
    || evidence.profileRestart !== 'passed' || evidence.upgrade !== 'passed') throw new Error(`Incomplete or stale native evidence for ${target}`)
  return true
}

/** Refuse partial releases, wrong versions, empty payloads, foreign URLs, or missing hashes. */
export function validateCatalog(catalog) {
  if (catalog?.schemaVersion !== 1 || !/^\d+\.\d+\.\d+$/.test(catalog.version)
    || !/^[a-f0-9]{40}$/.test(catalog.source) || !['unsigned-preview', 'signed'].includes(catalog.signing)
    || !Array.isArray(catalog.downloads) || catalog.downloads.length !== TARGETS.length) throw new Error('Invalid release catalog')
  const expected = new Set(TARGETS)
  for (const entry of catalog.downloads) {
    if (!expected.delete(entry.target) || entry.name !== installerName(catalog.version, entry.target)
      || !Number.isSafeInteger(entry.size) || entry.size <= 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Invalid release asset')
    const url = new URL(entry.url)
    if (url.href !== `https://github.com/jinxlo/Nulu-harness/releases/download/v${catalog.version}/${entry.name}`) throw new Error('Foreign release asset URL')
  }
  return catalog
}

async function sha256(path) {
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return hash.digest('hex')
}

export async function buildCatalog(root, version, source) {
  const names = readdirSync(root)
  const required = [...TARGETS.map(target => installerName(version, target)), ...['arm64', 'x64'].map(arch => `nulu-harness-${version}-mac-${arch}.zip`)]
  for (const name of required) if (!names.includes(name) || statSync(join(root, name)).size <= 0) throw new Error(`Missing required release payload: ${name}`)
  const downloads = []
  for (const target of TARGETS) {
    const name = installerName(version, target)
    downloads.push({ target, name, size: statSync(join(root, name)).size, sha256: await sha256(join(root, name)), url: `https://github.com/jinxlo/Nulu-harness/releases/download/v${version}/${name}` })
  }
  return validateCatalog({ schemaVersion: 1, version, source, signing: 'unsigned-preview', downloads })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [directory, version, source] = process.argv.slice(2)
  if (!directory || !version || !source) throw new Error('Usage: release-catalog.mjs <asset-directory> <version> <source-sha>')
  const catalog = await buildCatalog(resolve(directory), version, source)
  writeFileSync(join(directory, 'nulu-release.json'), `${JSON.stringify(catalog, null, 2)}\n`)
  const hashes = []
  for (const name of readdirSync(directory).filter(name => name !== 'SHA256SUMS').sort()) {
    if (statSync(join(directory, name)).isFile()) hashes.push(`${await sha256(join(directory, name))}  ${basename(name)}`)
  }
  writeFileSync(join(directory, 'SHA256SUMS'), `${hashes.join('\n')}\n`)
}
