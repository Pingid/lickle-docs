import type * as reflect from '../reflect/index.ts'
import * as path from '../../_lib/path/index.ts'
import type { ProjectJson } from './types.ts'

export const getNaming = (json: ProjectJson) => {
  const slugs = path.slugMaker()

  for (const p of json.pages) p.slug = slugs.uniq(p.slug ?? p.title)

  // for (const m of json.modules) m.slug = slugs.uniq(m.path)

  return {
    rootName: json.name,
    aliases: new Map(),
    commonDir: '',
  }
}

/** Display + URL identity for a route. */
export type Parts = { label: string; slug: string; qualified: string }

export type NameOptions = {
  /** Project name, used as the label of the main entry module. */
  rootName: string
  /** Module path -> entrypoint alias (the `as` value without a leading `./`). */
  aliases: Map<string, string>
  /** Common directory prefix shared by every module path. */
  commonDir: string
}

/**
 * Parts for a root entry module — its slug is the site-relative base that all
 * descendants build on. The main entry (`.`) lives at the root (`''`).
 */
export const rootParts = (d: reflect.Module, opts: NameOptions): Parts => {
  const alias = opts.aliases.get(d.path)
  if (alias && alias !== '.') return { label: alias, slug: alias, qualified: alias }
  const seg = moduleSegments(d.path, opts.commonDir)
  if (seg.length === 0) return { label: opts.rootName, slug: '', qualified: opts.rootName }
  const joined = seg.join('.')
  return { label: joined, slug: seg.join('/'), qualified: joined }
}

/** Parts for a route nested under `parent`, named by its local `segment`. */
export const childParts = (segment: string, parent: Parts): Parts => ({
  label: segment,
  slug: parent.slug ? `${parent.slug}/${segment}` : segment,
  qualified: parent.qualified ? `${parent.qualified}.${segment}` : segment,
})

/**
 * Module path -> path segments, relative to the common source dir, with the
 * file extension dropped and a trailing `index` removed. Pure string ops, so
 * no regex is built from (and broken by) arbitrary file paths.
 */
const moduleSegments = (modulePath: string, commonDir: string): string[] => {
  let rel = modulePath
  if (commonDir && rel.startsWith(commonDir)) rel = rel.slice(commonDir.length)
  const segs = rel.split('/').filter(Boolean)
  const last = segs[segs.length - 1]
  if (last && /^index\./.test(last)) segs.pop()
  else if (last) segs[segs.length - 1] = path.stripExt(last)
  return segs
}
