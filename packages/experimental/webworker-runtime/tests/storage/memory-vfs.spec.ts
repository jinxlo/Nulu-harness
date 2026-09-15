/**
 * The identity, timestamp, link, mutation, and durability-sink guarantees
 * MemoryVfs owes its consumers, asserted directly rather than through the
 * `node:fs` bridge.
 *
 * `nulu-fs-local` builds a version token from `dev:ino:size:mtimeNs:ctimeNs` and
 * refuses a write whose token moved since it read. Two properties carry that:
 * `ino` identifies the entry at a path, and `mtimeMs` moves on every write. The
 * timestamp cases freeze the clock, because these writes are in memory and two
 * revisions routinely land in the same millisecond — a real-clock test passes
 * whether or not the strict increment exists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryVfs } from '../../src/storage/memory.ts'
import type { VfsBigIntStats, VfsMutation, VfsMutationSink, VfsStats } from '../../src/storage/types.ts'

const identity = (vfs: MemoryVfs, path: string): bigint =>
  (vfs.statSync(path, { bigint: true }) as VfsBigIntStats).ino

const linkCount = (vfs: MemoryVfs, path: string): bigint =>
  (vfs.statSync(path, { bigint: true }) as VfsBigIntStats).nlink

const modified = (vfs: MemoryVfs, path: string): number => (vfs.statSync(path) as VfsStats).mtimeMs

afterEach(() => { vi.restoreAllMocks() })

describe('entry identity', () => {
  it('distinguishes paths and holds each identity across repeated stats', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nulu/one.txt', 'one')
    vfs.seed('/nulu/two.txt', 'two')
    const first = identity(vfs, '/nulu/one.txt')
    expect(identity(vfs, '/nulu/two.txt')).not.toBe(first)
    expect(identity(vfs, '/nulu/one.txt')).toBe(first)
  })

  it('forgets the identities under a directory removed as a subtree', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nulu/skills/git/SKILL.md', '# git\n')
    const before = identity(vfs, '/nulu/skills/git/SKILL.md')
    vfs.rmSync('/nulu/skills', { recursive: true })
    vfs.seed('/nulu/skills/git/SKILL.md', '# git rebuilt\n')
    expect(identity(vfs, '/nulu/skills/git/SKILL.md')).not.toBe(before)
  })

  it('moves the source identity when a file replaces another path', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nulu/from.txt', 'moved')
    vfs.seed('/nulu/to.txt', 'replaced')
    const [source, destination] = [identity(vfs, '/nulu/from.txt'), identity(vfs, '/nulu/to.txt')]
    vfs.renameSync('/nulu/from.txt', '/nulu/to.txt')
    const renamed = identity(vfs, '/nulu/to.txt')
    expect(vfs.readFileSync('/nulu/to.txt', 'utf8')).toBe('moved')
    expect([renamed === source, renamed === destination]).toEqual([true, false])
  })
})

describe('modification time', () => {
  it('hydrates explicit metadata without confusing timestamps with permission bits', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nulu/restored', 'value', { mode: 0o600, mtimeMs: 1_600_000_000_000 })
    vfs.seedDirectory('/nulu/restored-directory', { mode: 0o700, mtimeMs: 1_600_000_000_001 })
    const stats = vfs.statSync('/nulu/restored') as VfsStats
    const directory = vfs.statSync('/nulu/restored-directory') as VfsStats
    expect([stats.mode & 0o777, stats.mtimeMs]).toEqual([0o600, 1_600_000_000_000])
    expect([directory.mode & 0o777, directory.mtimeMs]).toEqual([0o700, 1_600_000_000_001])
  })

  it('advances on every write even while the clock stands still', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seed('/nulu/log.jsonl', 'first\n')
    const seeded = modified(vfs, '/nulu/log.jsonl')
    vfs.writeFileSync('/nulu/log.jsonl', 'second\n')
    const written = modified(vfs, '/nulu/log.jsonl')
    vfs.appendFileSync('/nulu/log.jsonl', 'third\n')
    const appended = modified(vfs, '/nulu/log.jsonl')
    vfs.truncateSync('/nulu/log.jsonl', 6)
    const truncated = modified(vfs, '/nulu/log.jsonl')
    expect([written > seeded, appended > written, truncated > appended]).toEqual([true, true, true])
    // One millisecond per revision: the increment is the minimum that separates
    // two tokens, not a coarser bump that would skew a real timestamp.
    expect(truncated - seeded).toBe(3)
  })

  it('takes the clock once the clock has passed the entry', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seed('/nulu/log.jsonl', 'first\n')
    clock.mockReturnValue(1_700_000_005_000)
    vfs.writeFileSync('/nulu/log.jsonl', 'second\n')
    expect(modified(vfs, '/nulu/log.jsonl')).toBe(1_700_000_005_000)
  })

  it('extends truncation with zero bytes', async () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nulu/file', new Uint8Array([1, 2]))
    vfs.truncateSync('/nulu/file', 5)
    expect([...vfs.readFileSync('/nulu/file') as Uint8Array]).toEqual([1, 2, 0, 0, 0])
    const handle = vfs.open('/nulu/file', 'r+')
    await handle.truncate(7)
    expect([...vfs.readFileSync('/nulu/file') as Uint8Array]).toEqual([1, 2, 0, 0, 0, 0, 0])
  })

  it('advances a directory only when its immediate entry set changes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/nulu/workspace')
    const empty = modified(vfs, '/nulu/workspace')
    vfs.writeFileSync('/nulu/workspace/file.txt', 'one')
    const created = modified(vfs, '/nulu/workspace')
    vfs.writeFileSync('/nulu/workspace/file.txt', 'two')
    const rewritten = modified(vfs, '/nulu/workspace')
    vfs.rmSync('/nulu/workspace/file.txt')
    const removed = modified(vfs, '/nulu/workspace')
    expect([created > empty, rewritten === created, removed > rewritten]).toEqual([true, true, true])
  })
})

describe('mutation publication', () => {
  it('publishes only committed runtime changes and keeps image seeding silent', () => {
    const vfs = new MemoryVfs()
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })
    vfs.seed('/nulu/seeded.txt', 'seeded')
    expect(mutations).toEqual([])
    vfs.writeFileSync('/nulu/seeded.txt', 'changed')
    vfs.mkdirSync('/nulu/created')
    vfs.chmodSync('/nulu/created', 0o700)
    vfs.renameSync('/nulu/seeded.txt', '/nulu/renamed.txt')
    vfs.rmSync('/nulu/created', { recursive: true })
    expect(mutations.map(mutation => ({
      kind: mutation.kind,
      path: mutation.path,
      ...mutation.kind === 'write' ? { entryChanged: mutation.entryChanged } : {},
      ...mutation.kind === 'chmod' ? { mode: mutation.mode } : {},
    }))).toEqual([
      { kind: 'write', path: '/nulu/seeded.txt', entryChanged: false },
      { kind: 'mkdir', path: '/nulu/created' },
      { kind: 'chmod', path: '/nulu/created', mode: 0o700 },
      { kind: 'remove', path: '/nulu/seeded.txt' },
      { kind: 'write', path: '/nulu/renamed.txt', entryChanged: true },
      { kind: 'remove', path: '/nulu/created' },
    ])
    const renamed = mutations[4]
    expect(renamed?.kind === 'write' && new TextDecoder().decode(renamed.bytes)).toBe('changed')
    expect(() => { vfs.writeFileSync('/missing/file', 'no') }).toThrow(/ENOENT/)
    expect(mutations).toHaveLength(6)
  })

  it('contains a faulty observer and lets disposal stop later notifications', () => {
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/nulu')
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {})
    const first = vfs.subscribe(() => { throw new Error('observer failed') })
    const seen: string[] = []
    const second = vfs.subscribe((mutation) => { seen.push(mutation.path) })
    vfs.writeFileSync('/nulu/one', '1')
    first()
    second()
    vfs.writeFileSync('/nulu/two', '2')
    expect(seen).toEqual(['/nulu/one'])
    expect(reported).toHaveBeenCalledOnce()
  })

  it('feeds the same complete mutations to a durable sink and live subscribers', async () => {
    const recorded: VfsMutation[] = []
    let flushes = 0
    const sink: VfsMutationSink = {
      record: (mutation) => { recorded.push(mutation) },
      flush: async () => { flushes += 1 },
    }
    const vfs = new MemoryVfs({ sink })
    vfs.seedDirectory('/nulu')
    const observed: VfsMutation[] = []
    vfs.subscribe((mutation) => { observed.push(mutation) })
    vfs.writeFileSync('/nulu/log', 'a')
    vfs.appendFileSync('/nulu/log', 'bc')
    await vfs.flush()
    expect(observed).toEqual(recorded)
    expect(observed[0]).toBe(recorded[0])
    expect(recorded[0]).toMatchObject({ kind: 'write', path: '/nulu/log', mode: 0o644, entryChanged: true })
    expect(recorded[1]).toMatchObject({ kind: 'write', path: '/nulu/log', mode: 0o644, entryChanged: false, appendedFrom: 1 })
    expect(recorded[1]?.kind === 'write' && new TextDecoder().decode(recorded[1].bytes)).toBe('abc')
    expect(flushes).toBe(1)
  })

  it('publishes descriptor writes at the file identity current path', () => {
    const mutations: VfsMutation[] = []
    const vfs = new MemoryVfs()
    vfs.seed('/nulu/source', 'old')
    const descriptor = vfs.openFileSync('/nulu/source', 'r+')
    vfs.subscribe((mutation) => { mutations.push(mutation) })
    vfs.renameSync('/nulu/source', '/nulu/destination')
    mutations.length = 0
    descriptor.write(0, new TextEncoder().encode('new'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/nulu/destination'])
    expect(vfs.readFileSync('/nulu/destination', 'utf8')).toBe('new')
    vfs.unlinkSync('/nulu/destination')
    mutations.length = 0
    descriptor.write(0, new TextEncoder().encode('detached'))
    expect(mutations).toEqual([])
    expect(new TextDecoder().decode(descriptor.read(0, descriptor.stat().size))).toBe('detached')
  })

  it('reports the path identity through a BigInt file handle stat', async () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nulu/session.lock', '')
    const handle = vfs.open('/nulu/session.lock', 'w')
    const held = await handle.stat({ bigint: true }) as VfsBigIntStats
    const current = vfs.statSync('/nulu/session.lock', { bigint: true }) as VfsBigIntStats

    expect([held.dev, held.ino]).toEqual([current.dev, current.ino])
    await handle.chmod(0o600)
    expect((vfs.statSync('/nulu/session.lock') as VfsStats).mode & 0o777).toBe(0o600)
    await handle.close()
  })

  it('decomposes a directory rename into replayable destination state', () => {
    const recorded: VfsMutation[] = []
    const vfs = new MemoryVfs({
      sink: { record: (mutation) => { recorded.push(mutation) }, flush: () => Promise.resolve() },
    })
    vfs.seedDirectory('/nulu/staging/nested', { mode: 0o700 })
    vfs.seed('/nulu/staging/nested/file', 'value', { mode: 0o600 })
    vfs.renameSync('/nulu/staging', '/nulu/published')

    expect(recorded.map(mutation => [mutation.kind, mutation.path])).toEqual([
      ['remove', '/nulu/staging'],
      ['mkdir', '/nulu/published'],
      ['mkdir', '/nulu/published/nested'],
      ['write', '/nulu/published/nested/file'],
    ])
    expect(recorded[3]).toMatchObject({ kind: 'write', mode: 0o600, entryChanged: true })
    expect(recorded[3]?.kind === 'write' && new TextDecoder().decode(recorded[3].bytes)).toBe('value')
  })
})

describe('directory rename', () => {
  it('rejects file, non-empty directory, and missing-parent destinations before mutation', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nulu/source/nested/file', 'source')
    vfs.seed('/nulu/file', 'destination')
    vfs.seed('/nulu/non-empty/child', 'destination')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    expect(() => { vfs.renameSync('/nulu/source', '/nulu/file') })
      .toThrow(expect.objectContaining({ code: 'ENOTDIR' }))
    expect(() => { vfs.renameSync('/nulu/source', '/nulu/non-empty') })
      .toThrow(expect.objectContaining({ code: 'ENOTEMPTY' }))
    expect(() => { vfs.renameSync('/nulu/source', '/missing/destination') })
      .toThrow(expect.objectContaining({ code: 'ENOENT' }))

    expect(vfs.readFileSync('/nulu/source/nested/file', 'utf8')).toBe('source')
    expect(vfs.readFileSync('/nulu/file', 'utf8')).toBe('destination')
    expect(vfs.readFileSync('/nulu/non-empty/child', 'utf8')).toBe('destination')
    expect(mutations).toEqual([])
  })

  it('replaces an empty directory with the source subtree', () => {
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/nulu/source/nested', { mode: 0o700 })
    vfs.seed('/nulu/source/nested/file', 'source')
    vfs.seedDirectory('/nulu/destination', { mode: 0o711 })

    vfs.renameSync('/nulu/source', '/nulu/destination')

    expect(vfs.existsSync('/nulu/source')).toBe(false)
    expect(vfs.readFileSync('/nulu/destination/nested/file', 'utf8')).toBe('source')
    expect((vfs.statSync('/nulu/destination') as VfsStats).mode & 0o777).toBe(0o755)
    expect((vfs.statSync('/nulu/destination/nested') as VfsStats).mode & 0o777).toBe(0o700)
  })
})

describe('hard links', () => {
  it('shares identity, bytes, and mode until one name is removed', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nulu/session.jsonl', 'committed\n')
    vfs.linkSync('/nulu/session.jsonl', '/nulu/session-latest.jsonl')
    vfs.linkSync('/nulu/session-latest.jsonl', '/nulu/session-archive.jsonl')
    expect(identity(vfs, '/nulu/session-latest.jsonl')).toBe(identity(vfs, '/nulu/session.jsonl'))
    expect(linkCount(vfs, '/nulu/session.jsonl')).toBe(3n)
    expect(vfs.readFileSync('/nulu/session-latest.jsonl', 'utf8')).toBe('committed\n')
    const changedPaths: string[] = []
    vfs.subscribe((mutation) => { changedPaths.push(mutation.path) })
    vfs.appendFileSync('/nulu/session.jsonl', 'appended\n')
    expect(changedPaths).toEqual([
      '/nulu/session.jsonl',
      '/nulu/session-latest.jsonl',
      '/nulu/session-archive.jsonl',
    ])
    expect(vfs.readFileSync('/nulu/session.jsonl', 'utf8')).toBe('committed\nappended\n')
    expect(vfs.readFileSync('/nulu/session-latest.jsonl', 'utf8')).toBe('committed\nappended\n')
    vfs.chmodSync('/nulu/session-latest.jsonl', 0o600)
    expect((vfs.statSync('/nulu/session.jsonl') as VfsStats).mode & 0o777).toBe(0o600)
    vfs.unlinkSync('/nulu/session-latest.jsonl')
    expect(linkCount(vfs, '/nulu/session.jsonl')).toBe(2n)
    vfs.unlinkSync('/nulu/session-archive.jsonl')
    expect(linkCount(vfs, '/nulu/session.jsonl')).toBe(1n)
    expect(vfs.readFileSync('/nulu/session.jsonl', 'utf8')).toBe('committed\nappended\n')
  })

  it('treats rename between names of the same node as a no-op', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nulu/source', 'value')
    vfs.linkSync('/nulu/source', '/nulu/alias')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    vfs.renameSync('/nulu/source', '/nulu/alias')

    expect(vfs.readFileSync('/nulu/source', 'utf8')).toBe('value')
    expect(vfs.readFileSync('/nulu/alias', 'utf8')).toBe('value')
    expect(linkCount(vfs, '/nulu/source')).toBe(2n)
    expect(mutations).toEqual([])
  })

  it('retargets linked names through file replacement and directory moves', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nulu/replacement', 'replacement')
    vfs.seed('/nulu/target', 'old')
    vfs.linkSync('/nulu/target', '/nulu/target-alias')
    const replaced = vfs.openFileSync('/nulu/target', 'r+')
    vfs.renameSync('/nulu/replacement', '/nulu/target')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    replaced.write(0, new TextEncoder().encode('changed'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/nulu/target-alias'])
    expect(vfs.readFileSync('/nulu/target', 'utf8')).toBe('replacement')
    expect(vfs.readFileSync('/nulu/target-alias', 'utf8')).toBe('changed')
    expect(linkCount(vfs, '/nulu/target-alias')).toBe(1n)

    vfs.seed('/nulu/tree/file', 'tree')
    vfs.linkSync('/nulu/tree/file', '/nulu/outside')
    const moved = vfs.openFileSync('/nulu/tree/file', 'r+')
    vfs.renameSync('/nulu/tree', '/nulu/moved')
    mutations.length = 0
    moved.write(0, new TextEncoder().encode('moved'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/nulu/outside', '/nulu/moved/file'])
    expect(linkCount(vfs, '/nulu/moved/file')).toBe(2n)

    vfs.rmSync('/nulu/moved', { recursive: true })
    mutations.length = 0
    moved.write(0, new TextEncoder().encode('kept!'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/nulu/outside'])
    expect(vfs.readFileSync('/nulu/outside', 'utf8')).toBe('kept!')
    expect(linkCount(vfs, '/nulu/outside')).toBe(1n)
  })

  it('rejects renaming a file over an existing directory', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nulu/file', 'value')
    vfs.seedDirectory('/nulu/directory')
    expect(() => { vfs.renameSync('/nulu/file', '/nulu/directory') }).toThrow(expect.objectContaining({ code: 'EISDIR' }))
    expect(vfs.readFileSync('/nulu/file', 'utf8')).toBe('value')
    expect(vfs.statSync('/nulu/directory').isDirectory()).toBe(true)
  })
})
