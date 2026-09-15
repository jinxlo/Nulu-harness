/** Pure archive-format and immutable-manifest helpers. */

import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { AGENT_NOTE_CLASSES } from './agent-note-tree.ts'

/** Versioned fields in the frozen-content manifest. */
export interface ArchiveManifest {
  version: 1 | 2
  files: Readonly<Record<string, string>>
}

/** Hash one archived artifact independently of the repository's Git object format. */
function archiveContentHash(content: Buffer): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parse the archive manifest and reject fields or hashes outside its closed schema. */
export function parseArchiveManifest(content: string): ArchiveManifest {
  const value: unknown = JSON.parse(content)
  if (!isRecord(value)) throw new Error('expected a JSON object')
  const fields = Object.keys(value).sort()
  if (fields.join(',') !== 'files,version') throw new Error('expected exactly the fields `version` and `files`')
  if (value.version !== 1 && value.version !== 2) throw new Error('unsupported manifest version (expected 1 or 2)')
  if (!isRecord(value.files)) throw new Error('`files` must be an object')
  const files: Record<string, string> = {}
  for (const [path, hash] of Object.entries(value.files)) {
    if (typeof hash !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(hash)) {
      throw new Error(`invalid content hash for ${path}`)
    }
    files[path] = hash
  }
  return { version: value.version, files }
}

/** Render the archive manifest with deterministic path ordering. */
export function renderArchiveManifest(files: Readonly<Record<string, string>>): string {
  return `${JSON.stringify({
    version: 2,
    files: Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right))),
  }, null, 2)}\n`
}

function documentCounts(files: Readonly<Record<string, string>>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const path of Object.keys(files)) {
    if (!path.endsWith('.md') || path.endsWith('.zh.md')) continue
    const match = /^([^/]+)\/(\d{4}-\d{2}-\d{2})-/.exec(path)
    if (match?.[1] === undefined || match[2] === undefined) continue
    const group = `${match[1]}/${match[2]}`
    counts.set(group, (counts.get(group) ?? 0) + 1)
  }
  return counts
}

/**
 * Reject changes or removals of entries sealed by a prior manifest.
 * Version 1 sealed bilingual triplets whose every document hash changed while
 * its path or filename moved, so the one-time migration retires `.zh.md` and
 * `.i18n.yaml` entries and admits renames, removals of a switcher line, and
 * `.md` hash changes per surviving kind/date group. Later baselines compare
 * every hash strictly.
 */
export function validateArchiveManifestExtension(
  baseline: ArchiveManifest,
  current: ArchiveManifest,
): string[] {
  const errors: string[] = []
  if (baseline.version === 1) {
    const currentCounts = documentCounts(current.files)
    for (const [group, expected] of documentCounts(baseline.files)) {
      const actual = currentCounts.get(group) ?? 0
      if (actual < expected) errors.push(`${group}: sealed archive lost ${expected - actual} document(s)`)
    }
    return errors
  }
  for (const [path, expected] of Object.entries(baseline.files)) {
    const actual = current.files[path]
    if (actual === undefined) errors.push(`${path}: sealed manifest entry is missing`)
    else if (actual !== expected) errors.push(`${path}: sealed manifest hash changed`)
  }
  return errors
}

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function validateHeader(path: string, content: Buffer, sourceBase: string): string[] {
  const errors: string[] = []
  const lines = content.toString('utf8').split('\n')
  if (!/^# Agent Note: \S/.test(lines[0] ?? '')) errors.push(`${path}: line 1 must be \`# Agent Note: <title>\``)
  if (lines[1] !== '') errors.push(`${path}: line 2 must be blank`)
  if (lines[2] !== 'Status: implemented') errors.push(`${path}: line 3 must be \`Status: implemented\``)
  const archived = /^Archived: (\d{4}-\d{2}-\d{2})$/.exec(lines[3] ?? '')?.[1]
  if (archived === undefined || !validDate(archived)) {
    errors.push(`${path}: line 4 must be \`Archived: YYYY-MM-DD\` with a valid date`)
  } else if (archived < sourceBase.slice(0, 10)) {
    errors.push(`${path}: archive date ${archived} predates the note filename`)
  }
  if (lines[4] !== '') errors.push(`${path}: line 5 must be blank`)
  if (lines[5] !== '') errors.push(`${path}: line 6 must be blank`)
  return errors
}

/** Validate the closed kind tree and implemented/archive headers. */
export function validateArchiveArtifacts(artifacts: ReadonlyMap<string, Buffer>): string[] {
  const errors: string[] = []
  const sources = new Map<string, Buffer>()
  for (const [path, content] of artifacts) {
    const match = /^([^/]+)\/(\d{4}-\d{2}-\d{2}-.+?)\.md$/.exec(path)
    if (path.endsWith('.zh.md') || match?.[1] === undefined || match[2] === undefined) {
      errors.push(`${path}: expected {kind}/yyyy-mm-dd-topic.md`)
      continue
    }
    if (!(AGENT_NOTE_CLASSES as readonly string[]).includes(match[1])) {
      errors.push(`${path}: unknown Agent Note kind ${JSON.stringify(match[1])}`)
      continue
    }
    sources.set(`${match[1]}/${match[2]}`, content)
  }

  for (const [key, source] of [...sources].sort(([left], [right]) => left.localeCompare(right))) {
    errors.push(...validateHeader(`${key}.md`, source, basename(key)))
  }
  return errors
}

/** Preserve every sealed path/hash and append hashes for newly archived artifacts. */
export function extendArchiveManifest(
  existing: ArchiveManifest,
  artifacts: ReadonlyMap<string, Buffer>,
): { files: Record<string, string>; added: string[]; errors: string[] } {
  const errors: string[] = []
  const files: Record<string, string> = { ...existing.files }
  for (const [path, expected] of Object.entries(existing.files)) {
    const content = artifacts.get(path)
    if (content === undefined) errors.push(`${path}: sealed artifact is missing`)
    else if (archiveContentHash(content) !== expected) errors.push(`${path}: sealed content hash changed`)
  }
  const added: string[] = []
  for (const [path, content] of [...artifacts].sort(([left], [right]) => left.localeCompare(right))) {
    if (files[path] !== undefined) continue
    files[path] = archiveContentHash(content)
    added.push(path)
  }
  return { files, added, errors }
}

/**
 * Resolve the manifest to write. Version 2 requires every sealed document to
 * survive unchanged; a version-1 manifest retires `.zh.md` and `.i18n.yaml`
 * entries, re-seals each surviving document once, and appends artifacts that
 * were never sealed. Renamed documents surface as retired entries whose
 * successor is appended; the migration's document floor is enforced by
 * `validateArchiveManifestExtension`.
 */
export function sealArchiveManifest(
  existing: ArchiveManifest,
  artifacts: ReadonlyMap<string, Buffer>,
): { files: Record<string, string>; added: string[]; errors: string[] } {
  if (existing.version === 2) return extendArchiveManifest(existing, artifacts)
  const errors: string[] = []
  const files: Record<string, string> = {}
  for (const path of Object.keys(existing.files)) {
    if (path.endsWith('.zh.md') || !path.endsWith('.md')) continue
    const content = artifacts.get(path)
    if (content !== undefined) files[path] = archiveContentHash(content)
  }
  const added: string[] = []
  for (const [path, content] of [...artifacts].sort(([left], [right]) => left.localeCompare(right))) {
    if (files[path] !== undefined) continue
    files[path] = archiveContentHash(content)
    added.push(path)
  }
  return { files, added, errors }
}
