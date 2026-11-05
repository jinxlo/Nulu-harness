/** Transform tracked UTF-8 product files while preserving Nulu-owned release controls. */
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, brandText, git, json, trustedPath } from './common.mjs'

export function rebrandTree({ check = false } = {}) {
  const manifest = json('nulu-fork-manifest.json')
  const changed = []
  for (const path of git(['ls-files', '-z']).split('\0').filter(Boolean)) {
    if (trustedPath(path) || path.startsWith('docs/persistence-changes/') || /^(?:vendor\/|\.agents\/notes\/|snapshots\/|reports\/)/.test(path)
      || /(?:^|\/)(?:LICENSE|NOTICE|THIRD_PARTY|CHANGELOG)/i.test(path)) continue
    const absolute = join(ROOT, path)
    if (!existsSync(absolute) || !lstatSync(absolute).isFile()) continue
    if ((manifest.removed_upstream_packages ?? []).some(removed => path.startsWith(`${removed}/`))) {
      changed.push(path)
      if (!check) git(['rm', '-f', '--ignore-unmatch', '--', path])
      continue
    }
    const bytes = readFileSync(absolute)
    if (bytes.includes(0)) continue
    const text = bytes.toString('utf8')
    if (!Buffer.from(text).equals(bytes)) continue
    const providerFixture = /(?:^|\/)(?:tests?|fixtures)(?:\/|$)|\.(?:spec|test|e2e)\./.test(path)
    const branded = brandText(text, { providerFixture })
    if (branded !== text) {
      changed.push(path)
      if (!check) writeFileSync(absolute, branded)
    }
  }
  return changed
}
