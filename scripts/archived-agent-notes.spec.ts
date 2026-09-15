import { describe, expect, it } from 'vitest'
import {
  extendArchiveManifest,
  parseArchiveManifest,
  renderArchiveManifest,
  sealArchiveManifest,
  validateArchiveArtifacts,
  validateArchiveManifestExtension,
  type ArchiveManifest,
} from './archived-agent-notes.ts'
import { isArchivedAgentNotePath } from './repo-files.ts'

function fixture(): Map<string, Buffer> {
  const base = '2026-07-26-example'
  const source = Buffer.from('# Agent Note: Example\n\nStatus: implemented\nArchived: 2026-07-26\n\n\n## Problem\n\nExample.\n')
  return new Map([[`process/${base}.md`, source]])
}

describe('archived Agent Notes', () => {
  it('recognizes archived paths with POSIX and Windows separators', () => {
    expect(isArchivedAgentNotePath('.agents/notes/archived/process/example.md')).toBe(true)
    expect(isArchivedAgentNotePath('.agents\\notes\\archived\\process\\example.md')).toBe(true)
    expect(isArchivedAgentNotePath('.agents/notes/implemented/process/example.md')).toBe(false)
  })

  it('accepts one implemented archive document', () => {
    expect(validateArchiveArtifacts(fixture())).toEqual([])
  })

  it('rejects invalid archive headers', () => {
    const artifacts = fixture()
    artifacts.set(
      'process/2026-07-26-example.md',
      Buffer.from('# Agent Note: Example\n\nStatus: proposed\nArchived: 2026-07-26\n\n\n## Problem\n\nExample.\n'),
    )
    expect(validateArchiveArtifacts(artifacts).join('\n')).toMatch(/line 3 must be `Status: implemented`/)
  })

  it('rejects a translated counterpart beside its English source', () => {
    const artifacts = fixture()
    artifacts.set('process/2026-07-26-example.zh.md', Buffer.from('translated'))
    expect(validateArchiveArtifacts(artifacts).join('\n')).toMatch(/expected \{kind\}\/yyyy-mm-dd-topic\.md/)
  })

  it('extends the manifest without permitting a sealed change or removal', () => {
    const artifacts = fixture()
    const empty: ArchiveManifest = { version: 2, files: {} }
    const first = extendArchiveManifest(empty, artifacts)
    expect(first.errors).toEqual([])
    expect(first.added).toHaveLength(1)

    const sealed: ArchiveManifest = { version: 2, files: first.files }
    const changed = new Map(artifacts)
    changed.set('process/2026-07-26-example.md', Buffer.from('changed'))
    expect(extendArchiveManifest(sealed, changed).errors).toEqual([
      'process/2026-07-26-example.md: sealed content hash changed',
    ])
    changed.delete('process/2026-07-26-example.md')
    expect(extendArchiveManifest(sealed, changed).errors).toContain(
      'process/2026-07-26-example.md: sealed artifact is missing',
    )
  })

  it('rejects replacing manifest seals alongside changed archive content', () => {
    const artifacts = fixture()
    const initial = extendArchiveManifest({ version: 2, files: {} }, artifacts)
    const baseline: ArchiveManifest = { version: 2, files: initial.files }
    const path = 'process/2026-07-26-example.md'
    const changedArtifacts = new Map(artifacts)
    changedArtifacts.set(path, Buffer.from('changed'))
    const replacement = extendArchiveManifest({ version: 2, files: {} }, changedArtifacts)
    const current: ArchiveManifest = { version: 2, files: replacement.files }

    expect(extendArchiveManifest(current, changedArtifacts).errors).toEqual([])
    expect(validateArchiveManifestExtension(baseline, current)).toEqual([
      `${path}: sealed manifest hash changed`,
    ])
    const removed: ArchiveManifest = {
      version: 2,
      files: Object.fromEntries(Object.entries(current.files).filter(([candidate]) => candidate !== path)),
    }
    expect(validateArchiveManifestExtension(baseline, removed)).toContain(
      `${path}: sealed manifest entry is missing`,
    )
  })

  it('retires translated counterparts and sidecars once when migrating a version-1 manifest', () => {
    const artifacts = fixture()
    const first = extendArchiveManifest({ version: 2, files: {} }, artifacts)
    const baseline: ArchiveManifest = {
      version: 1,
      files: {
        'process/2026-07-26-example.md': `sha256:${'a'.repeat(64)}`,
        'process/2026-07-26-example.zh.md': `sha256:${'b'.repeat(64)}`,
        'process/2026-07-26-example.i18n.yaml': `sha256:${'c'.repeat(64)}`,
      },
    }
    const current: ArchiveManifest = { version: 2, files: first.files }

    expect(validateArchiveManifestExtension(baseline, current)).toEqual([])

    const renamed: ArchiveManifest = {
      version: 2,
      files: { 'process/2026-07-26-renamed-example.md': `sha256:${'d'.repeat(64)}` },
    }
    expect(validateArchiveManifestExtension(baseline, renamed)).toEqual([])

    const missingDocument: ArchiveManifest = { version: 2, files: {} }
    expect(validateArchiveManifestExtension(baseline, missingDocument)).toEqual([
      'process/2026-07-26: sealed archive lost 1 document(s)',
    ])
  })

  it('round-trips the deterministic manifest schema', () => {
    const content = renderArchiveManifest({ 'process/z.md': `sha256:${'a'.repeat(64)}` })
    expect(parseArchiveManifest(content)).toEqual({
      version: 2,
      files: { 'process/z.md': `sha256:${'a'.repeat(64)}` },
    })
  })

  it('re-seals a version-1 manifest once while retiring translated counterparts', () => {
    const artifacts = fixture()
    const existing: ArchiveManifest = {
      version: 1,
      files: {
        'process/2026-07-26-example.md': `sha256:${'a'.repeat(64)}`,
        'process/2026-07-26-example.zh.md': `sha256:${'b'.repeat(64)}`,
        'process/2026-07-26-example.i18n.yaml': `sha256:${'c'.repeat(64)}`,
      },
    }
    const sealed = sealArchiveManifest(existing, artifacts)

    expect(sealed.errors).toEqual([])
    expect(sealed.added).toEqual([])
    expect(Object.keys(sealed.files)).toEqual(['process/2026-07-26-example.md'])
    expect(renderArchiveManifest(sealed.files)).toContain('"version": 2')
    expect(parseArchiveManifest(renderArchiveManifest(sealed.files)).files).toEqual(sealed.files)

    const renamed: ArchiveManifest = { version: 1, files: { 'process/2026-07-26-gone.md': `sha256:${'d'.repeat(64)}` } }
    const migrated = sealArchiveManifest(renamed, artifacts)
    expect(migrated.errors).toEqual([])
    expect(migrated.added).toEqual(['process/2026-07-26-example.md'])
  })

  it('keeps version-2 seals strict when sealing a write', () => {
    const artifacts = fixture()
    const first = extendArchiveManifest({ version: 2, files: {} }, artifacts)
    const changed = new Map(artifacts)
    changed.set('process/2026-07-26-example.md', Buffer.from('changed'))
    expect(sealArchiveManifest({ version: 2, files: first.files }, changed).errors).toEqual([
      'process/2026-07-26-example.md: sealed content hash changed',
    ])
  })
})
