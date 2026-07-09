import path from 'node:path'
import fg from 'fast-glob'

import { Node, Frontmatter } from '../../_lib/index.ts'
import type { ContentSource } from '../layout/types.ts'
import type { Diagnostic } from '../diagnostic/types.ts'
import type { GlobEntry, Page, PageEntry } from './types.ts'

/** Extensions treated as a SolidJS component module rather than markdown. */
const COMPONENT_EXT = new Set(['.tsx', '.jsx', '.ts', '.js', '.mts', '.mjs'])
const MARKDOWN_EXT = new Set(['.md', '.mdx', '.markdown'])

/**
 * Resolve the `pages` config into the {@link ContentSource} list the layout
 * places. Three inputs collapse into one output shape:
 *
 * - a glob string — every match becomes a page, its folder derived from the
 *   directory structure below the glob's fixed prefix, so `docs/guides/*.md`
 *   nests exactly as the filesystem does;
 * - a `{ title, content }` object whose `content` is a file path — markdown is
 *   read inline, a `.tsx`/`.jsx` module becomes a component page;
 * - a `{ title, content }` object whose `content` is markdown text — used as-is.
 *
 * Frontmatter always wins over derived values, and a `draft: true` page is
 * skipped, so a work-in-progress guide can sit in the glob without shipping.
 *
 * Ordering is two-level: an entry's position in `pages` decides which block of
 * the sidebar its pages occupy, and frontmatter `order` / a numeric filename
 * prefix / match position orders them within that block.
 */
export const resolvePages = async (
  dir: string,
  entries: PageEntry[],
  emit: (d: Diagnostic) => void,
): Promise<ContentSource[]> => {
  const out: ContentSource[] = []
  const seen = new Set<string>()

  for (const [entryIndex, entry] of entries.entries()) {
    const glob = asGlobEntry(entry)
    if (glob) {
      let within = 0
      for (const pattern of Array.isArray(glob.glob) ? glob.glob : [glob.glob]) {
        for (const file of await expand(dir, pattern)) {
          if (seen.has(file.path)) continue
          seen.add(file.path)
          const page = await fromFile(
            dir,
            file.path,
            {
              folder: folderFor(glob, file.folder),
              ...(glob.group === undefined ? {} : { group: glob.group }),
              // A fallback, not an override: frontmatter and a numeric filename
              // prefix both outrank match position.
              position: (glob.order ?? 0) + within,
            },
            emit,
          )
          if (page) out.push(slot(page, entryIndex))
          within++
        }
      }
      continue
    }

    const explicit = entry as Page
    const ext = path.extname(explicit.content).toLowerCase()
    const looksLikePath = MARKDOWN_EXT.has(ext) || COMPONENT_EXT.has(ext)
    if (!looksLikePath) {
      // Inline markdown: no file, so no frontmatter and nothing to read.
      out.push(slot({ kind: 'markdown', content: explicit.content, ...fields(explicit) }, entryIndex))
      continue
    }

    const abs = path.resolve(dir, explicit.content)
    seen.add(abs)
    const page = await fromFile(dir, abs, explicit, emit)
    if (page) out.push(slot(page, entryIndex))
  }

  return out
}

/**
 * Spacing between `pages` entries in the sort order. Wide enough that a glob's
 * own ordering — frontmatter `order`, a numeric filename prefix, or match
 * position — never spills into the next entry's block.
 */
const ENTRY_STRIDE = 1000

/**
 * Place a page in the sort order: its entry's position in `pages` dominates,
 * and whatever the page said about itself orders it *within* that entry. So the
 * config decides which section comes first and the files decide the order
 * inside it — neither can override the other by accident.
 */
const slot = <T extends ContentSource>(page: T, entryIndex: number): T => ({
  ...page,
  order: entryIndex * ENTRY_STRIDE + (page.order ?? 0),
})

/** Normalize the two glob forms; `undefined` when the entry is an explicit page. */
const asGlobEntry = (entry: PageEntry): GlobEntry | undefined => {
  if (typeof entry === 'string') return { glob: entry }
  return 'glob' in entry ? entry : undefined
}

/**
 * Combine the entry's folder policy with the folder the file's directory
 * implies: `false` drops both, a string prefixes the derived part, and an
 * omitted policy keeps the derived part alone.
 */
const folderFor = (glob: GlobEntry, derived?: string): string | undefined => {
  if (glob.folder === false) return undefined
  if (glob.folder === undefined) return derived
  return derived ? `${glob.folder}/${derived}` : glob.folder
}

/** The explicit fields a `Page` contributes, minus its `content`. */
const fields = (p: Partial<Page>) => ({
  title: p.title ?? 'Untitled',
  slug: p.slug,
  folder: p.folder,
  group: p.group,
  order: p.order,
})

/**
 * Expand one glob into files plus the folder each implies. The folder is the
 * file's directory *below the glob's fixed prefix* — `docs/guides/**\/*.md`
 * puts `docs/guides/advanced/x.md` in the `advanced` folder, not
 * `docs/guides/advanced`, so moving the glob's root never renames a section.
 */
const expand = async (dir: string, pattern: string): Promise<{ path: string; folder?: string }[]> => {
  const [task] = fg.generateTasks(pattern)
  const base = path.resolve(dir, task?.base ?? '.')
  const matches = await fg.glob(pattern, { cwd: dir, absolute: true, onlyFiles: true })
  return matches.sort().map((file) => {
    const rel = path.relative(base, path.dirname(file))
    const folder = rel && !rel.startsWith('..') ? posix(rel) : undefined
    return { path: file, folder: folder || undefined }
  })
}

/** Build a page from a file on disk, reading frontmatter when it is markdown. */
const fromFile = async (
  dir: string,
  abs: string,
  defaults: Partial<Page> & { folder?: string; position?: number },
  emit: (d: Diagnostic) => void,
): Promise<ContentSource | undefined> => {
  const rel = posix(path.relative(dir, abs))
  const ext = path.extname(abs).toLowerCase()

  if (COMPONENT_EXT.has(ext) && !MARKDOWN_EXT.has(ext)) {
    // A component page has no readable body — the bundler resolves the module.
    // Only the declared fields apply, plus a title derived from the filename.
    return {
      kind: 'component',
      module: rel,
      file: rel,
      title: defaults.title ?? titleFromFile(abs),
      slug: defaults.slug,
      folder: defaults.folder,
      group: defaults.group,
      order: defaults.order ?? numericPrefix(abs) ?? defaults.position,
    }
  }

  const raw = await read(abs, emit)
  if (raw === undefined) return undefined

  const { data, body } = Frontmatter.parse(raw)
  if (data['draft'] === true) return undefined

  // Precedence: what the file says about itself, then its filename, then where
  // it fell in the glob.
  const order = Frontmatter.num(data, 'order') ?? defaults.order ?? numericPrefix(abs) ?? defaults.position
  return {
    kind: 'markdown',
    content: body,
    file: rel,
    title: Frontmatter.str(data, 'title') ?? defaults.title ?? Frontmatter.heading(body) ?? titleFromFile(abs),
    slug: Frontmatter.str(data, 'slug') ?? defaults.slug,
    folder: Frontmatter.str(data, 'folder') ?? defaults.folder,
    group: Frontmatter.str(data, 'group') ?? defaults.group,
    ...(order === undefined ? {} : { order }),
  }
}

const read = async (abs: string, emit: (d: Diagnostic) => void): Promise<string | undefined> => {
  try {
    return await Node.Fs.readFile(abs, 'utf-8')
  } catch (error) {
    emit({
      level: 'warn',
      code: 'page-read',
      source: abs,
      message: `Could not read page ${abs}: ${error instanceof Error ? error.message : String(error)}`,
    })
    return undefined
  }
}

/** `docs/guides/02-getting-started.md` → `Getting started`. */
const titleFromFile = (abs: string): string => {
  const stem = path.basename(abs, path.extname(abs)).replace(/^\d+[-_.]/, '')
  const words = stem.replace(/[-_]+/g, ' ').trim()
  if (!words) return 'Untitled'
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** `02-getting-started.md` → `2`, so filesystem order is sidebar order for free. */
const numericPrefix = (abs: string): number | undefined => {
  const m = /^(\d+)[-_.]/.exec(path.basename(abs))
  return m ? Number(m[1]) : undefined
}

const posix = (p: string): string => p.split(path.sep).join('/')

/** The default when a config declares no pages: `README.md` as the home page. */
export const defaultPages = async (dir: string): Promise<ContentSource[]> => {
  const readme = await Node.Fs.existingPath(path.resolve(dir, 'README.md'))
  if (!readme) return []
  const content = await Node.Fs.readFile(readme, 'utf-8')
  if (!content) return []
  return [{ kind: 'markdown', title: 'README', slug: '/', content, file: 'README.md' }]
}
