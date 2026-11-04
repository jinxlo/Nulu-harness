/** Publish only a complete native matrix, verified downloads, and the exact qualified source commit. */
import { createHash } from 'node:crypto'
import { copyFileSync, createReadStream, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { command, git } from './common.mjs'
import { buildCatalog, installerName, TARGETS, versionOrder } from './release-catalog.mjs'

const version = process.env.NULU_RELEASE_VERSION
const source = process.env.NULU_CANDIDATE_SHA
const base = process.env.NULU_EXPECTED_BASE
if (!/^\d+\.\d+\.\d+$/.test(version ?? '') || !/^[a-f0-9]{40}$/.test(source ?? '') || !/^[a-f0-9]{40}$/.test(base ?? '')) throw new Error('Release identity is missing or invalid')
if (git(['rev-parse', 'HEAD']) !== source) throw new Error('Publish checkout differs from the qualified candidate')
const repository = 'jinxlo/Nulu-harness'
const tag = `v${version}`
const current = JSON.parse(command('gh', ['api', `repos/${repository}/releases/latest`]))
const currentVersion = current.tag_name?.replace(/^v/, '')
if (!currentVersion || versionOrder(version, currentVersion) < 0) throw new Error('Refusing to replace the current release with an older version')
const input = resolve('release-input')
const output = resolve('release-output')
mkdirSync(output, { recursive: true })

function filesUnder(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}
const files = filesUnder(input)
function unique(name) {
  const matches = files.filter(path => path.split(/[\\/]/).at(-1) === name)
  if (matches.length !== 1) throw new Error(`Expected exactly one ${name}, found ${matches.length}`)
  return matches[0]
}
for (const target of TARGETS) {
  const evidence = JSON.parse(readFileSync(unique(`${target}-evidence.json`), 'utf8'))
  if (evidence.schemaVersion !== 1 || evidence.target !== target || evidence.source !== source || evidence.version !== version
    || evidence.branding !== 'passed' || evidence.updateNotification !== 'passed' || evidence.packagedLaunch !== 'passed' || evidence.profileRestart !== 'passed' || evidence.upgrade !== 'passed') throw new Error(`Incomplete or stale native evidence for ${target}`)
}
const assets = [...TARGETS.map(target => installerName(version, target)), ...['arm64', 'x64'].map(arch => `nulu-harness-${version}-mac-${arch}.zip`)]
for (const name of assets) copyFileSync(unique(name), join(output, name))
const catalog = await buildCatalog(output, version, source)
writeFileSync(join(output, 'nulu-release.json'), `${JSON.stringify(catalog, null, 2)}\n`)
assets.push('nulu-release.json')
const checksums = new Map()
async function hash(path) {
  const digest = createHash('sha256')
  for await (const bytes of createReadStream(path)) digest.update(bytes)
  return digest.digest('hex')
}
for (const name of assets) checksums.set(name, await hash(join(output, name)))
writeFileSync(join(output, 'SHA256SUMS'), `${[...checksums].map(([name, digest]) => `${digest}  ${name}`).join('\n')}\n`)
assets.push('SHA256SUMS')
const notes = join(output, 'notes.md')
writeFileSync(notes, `Nulu Harness ${version}\n\nDeveloper preview for Windows, Apple Silicon, Intel Mac, and Linux.\n\nAll four installers passed packaged startup, upgrade, restart, and branding checks. The release also passed the required source, browser, and real Nulu API checks.\n\nWindows and macOS installers are unsigned previews and may require first-run confirmation. This release uses download notifications; it does not claim signed in-app installation.\n`)

let release
try { release = JSON.parse(command('gh', ['api', `repos/${repository}/releases/tags/${tag}`])) }
catch (error) {
  if (!String(error.stderr).includes('404')) throw error
}
const alreadyPublished = release && !release.draft
if (!release) command('gh', ['release', 'create', tag, '--repo', repository, '--target', source, '--draft', '--title', `Nulu Harness ${version}`, '--notes-file', notes])
if (!alreadyPublished) command('gh', ['release', 'upload', tag, '--repo', repository, '--clobber', ...assets.map(name => join(output, name))], { stdio: 'inherit' })

// Re-download staged bytes with authentication; a successful upload response is insufficient.
const verification = join(output, 'download-verification')
mkdirSync(verification, { recursive: true })
command('gh', ['release', 'download', tag, '--repo', repository, '--dir', verification, ...assets.flatMap(name => ['--pattern', name])])
for (const [name, expected] of checksums) if (await hash(join(verification, name)) !== expected) throw new Error(`Hosted download checksum mismatch: ${name}`)
if (readFileSync(join(verification, 'SHA256SUMS'), 'utf8') !== readFileSync(join(output, 'SHA256SUMS'), 'utf8')) throw new Error('Hosted checksum manifest differs')

const observed = git(['ls-remote', 'origin', 'refs/heads/main']).split(/\s/)[0]
if (!alreadyPublished) {
  if (observed !== base && observed !== source) throw new Error('Nulu main advanced during qualification; regenerate this candidate')
  if (observed !== source) command('git', ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', 'push', '--atomic', 'origin', `${source}:refs/heads/main`, `${source}:refs/tags/${tag}`], { stdio: 'inherit' })
  command('gh', ['release', 'edit', tag, '--repo', repository, '--draft=false', '--latest', '--notes-file', notes])
}
const published = JSON.parse(command('gh', ['api', `repos/${repository}/releases/latest`]))
if (published.tag_name !== tag || published.draft) throw new Error('Release promotion did not become the public latest release')
console.log(`Published ${tag}: every platform passed and every hosted asset matched its checksum`)
