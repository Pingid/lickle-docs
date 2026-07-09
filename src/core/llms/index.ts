import { createLayoutRouter, type LayoutRouter } from '../layout/client.ts'
import type { PageNode, SidebarNode } from '../layout/types.ts'
import { routeToMarkdown, type DeclarationLookup } from '../markdown/index.ts'
import type { ProjectVersion } from '../config/types.ts'
import type * as Reflect from '../reflect/types.ts'

/**
 * `llms.txt` and friends — the plain-text view of the site, for language models
 * and anything else that would rather read markdown than execute a SPA.
 *
 * Three artifacts, following the llmstxt.org convention:
 *
 * - **`/llms.txt`** — an index. The project name, a summary, then one section
 *   per top-level sidebar group listing every page as a link plus a one-line
 *   description. Small enough to fetch as an opening move.
 * - **`/llms-full.txt`** — every page's markdown concatenated, for a model that
 *   wants the whole corpus in one request.
 * - **`/<slug>.md`** — each page on its own, so a link found in `llms.txt` can
 *   be followed to just that page.
 *
 * All three come from the same serializer the "copy as markdown" button uses,
 * so what a model reads is what a human would copy.
 */

export type LlmsOptions = {
  /**
   * Absolute origin the docs are published under, e.g. `https://example.com/docs`.
   * Links are absolute when given — the convention, since a model may have
   * fetched the file out of context — and root-relative otherwise.
   */
  site?: string
  /** Text for the summary blockquote. Defaults to the home page's first paragraph. */
  description?: string
  /**
   * Whether a `.md` is emitted beside every page. When it is, links point at
   * the markdown rather than the HTML — a reader following a link from
   * `llms.txt` should land on prose, not on a page it has to render. Default
   * `true`; set `false` and links fall back to the page URLs.
   */
  pages?: boolean
}

/** One generated file: where it goes, and what is in it. */
export type LlmsFile = { path: string; content: string }

/**
 * Every file the llms.txt support emits, ready to write into the output
 * directory or serve from the dev server.
 */
export const llmsFiles = (
  project: ProjectVersion,
  opts: LlmsOptions & { index?: boolean; full?: boolean; pages?: boolean } = {},
): LlmsFile[] => {
  const files: LlmsFile[] = []
  if (opts.index !== false) files.push({ path: 'llms.txt', content: llmsTxt(project, opts) })
  if (opts.full !== false) files.push({ path: 'llms-full.txt', content: llmsFullTxt(project, opts) })
  if (opts.pages !== false) files.push(...pageFiles(project, opts))
  return files
}

/** The URL a link should point at: the page's markdown when we emit it, else the page. */
const linkFor = (slug: string, cx: Context): string => (cx.markdownLinks ? cx.url(filePath(slug)) : cx.url(slug))

// ─────────────────────────────────────────────────────────────────────────
// The index
// ─────────────────────────────────────────────────────────────────────────

/**
 * The `llms.txt` index: an H1 of the project name, a `>` summary, then one `##`
 * section per top-level sidebar group, each listing its pages as
 * `- [Title](url): description`.
 *
 * Sections mirror the sidebar rather than the page list, so the structure a
 * reader sees is the structure a model gets — a "Guides" heading stays a
 * "Guides" heading. Nested pages are flattened into their top-level section
 * with their qualified label, since llms.txt is a flat list by design.
 */
export const llmsTxt = (project: ProjectVersion, opts: LlmsOptions = {}): string => {
  const cx = context(project, opts)
  const out: string[] = [`# ${project.name}`]

  const summary = opts.description ?? homeSummary(cx)
  if (summary) out.push('', `> ${summary}`)

  for (const section of sections(cx)) {
    const rows = section.entries.map((e) => {
      const desc = describe(e.page, cx)
      return `- [${e.label}](${linkFor(e.page.slug, cx)})${desc ? `: ${desc}` : ''}`
    })
    if (!rows.length) continue
    out.push('', `## ${section.title}`, '', ...rows)
  }

  return out.join('\n') + '\n'
}

/** A flattened top-level sidebar group: its heading and every page beneath it. */
type Section = { title: string; entries: Entry[] }
type Entry = { label: string; page: PageNode }

/**
 * Walk the *router's* sidebar — the one with slugs already prefixed — so an
 * entry's link matches the page the site actually serves.
 */
const sections = (cx: Context): Section[] => {
  const out: Section[] = []
  for (const group of cx.router.sidebar) {
    // The unnamed bucket has no heading in the sidebar either; "Overview" is
    // the conventional llms.txt name for that leading run.
    const section: Section = { title: group.group || 'Overview', entries: [] }
    for (const node of group.items) collect(node, cx, section.entries, undefined)
    out.push(section)
  }
  return out
}

/** Depth-first walk, keeping the qualified label the sidebar shows for nested entries. */
const collect = (node: SidebarNode, cx: Context, into: Entry[], prefix?: string): void => {
  const label = node.kind === 'doc' ? (node.display ?? node.label) : node.label
  const qualified = prefix ? `${prefix} / ${label}` : label
  if (node.kind !== 'folder') {
    // Resolve by id where we can: a declaration's canonical page is the one to
    // link, even when the same node appears under several sidebar parents.
    const page = node.kind === 'doc' ? cx.router.get({ id: node.id }) : cx.router.get({ slug: node.slug })
    if (page) into.push({ label: qualified, page })
  }
  for (const group of node.children) for (const child of group.items) collect(child, cx, into, qualified)
}

// ─────────────────────────────────────────────────────────────────────────
// The full corpus, and per-page files
// ─────────────────────────────────────────────────────────────────────────

/** Every page's markdown in sidebar order, separated by rules. */
export const llmsFullTxt = (project: ProjectVersion, opts: LlmsOptions = {}): string => {
  const cx = context(project, opts)
  const parts = [`# ${project.name}`]
  const summary = opts.description ?? homeSummary(cx)
  if (summary) parts.push(`> ${summary}`)
  for (const page of ordered(cx)) parts.push(markdownFor(page, cx).trimEnd())
  return parts.join('\n\n---\n\n') + '\n'
}

/** One markdown file per page, at `<slug>.md` — what a link in `llms.txt` resolves to. */
export const pageFiles = (project: ProjectVersion, opts: LlmsOptions = {}): LlmsFile[] => {
  const cx = context(project, opts)
  return ordered(cx).map((page) => ({
    path: filePath(page.slug),
    content: markdownFor(page, cx),
  }))
}

/** The home page becomes `index.md`; every other slug gains a `.md` extension. */
const filePath = (slug: string): string => {
  const rel = slug.replace(/^\/+/, '')
  return rel === '' ? 'index.md' : `${rel}.md`
}

// ─────────────────────────────────────────────────────────────────────────
// Shared plumbing
// ─────────────────────────────────────────────────────────────────────────

type Context = {
  router: LayoutRouter
  lookup: DeclarationLookup
  byName: Map<string, Reflect.Declaration>
  url: (slug: string) => string
  slugOf: (name: string) => string | undefined
  markdownLinks: boolean
}

const context = (project: ProjectVersion, opts: LlmsOptions): Context => {
  const router = createLayoutRouter({
    pages: project.pages,
    sidebar: project.sidebar,
    redirects: project.redirects,
    prefix: project.prefix,
  })

  const byId = new Map<number, Reflect.Declaration>()
  const byName = new Map<string, Reflect.Declaration>()
  for (const d of project.declarations) {
    byId.set(d.id, d)
    if (!byName.has(d.name)) byName.set(d.name, d)
  }

  const origin = opts.site?.replace(/\/+$/, '')
  const url = (slug: string) => {
    const path = `/${slug.replace(/^\/+/, '')}`
    return origin ? `${origin}${path === '/' ? '' : path}` : path
  }

  const cx: Context = {
    router,
    lookup: { byId: (id) => byId.get(id) },
    byName,
    url,
    markdownLinks: opts.pages !== false,
    // `{@link Foo}` resolves to Foo's page, matching whatever the index links
    // to — a model following a reference mid-document should land on the same
    // kind of content it started in.
    slugOf: (name) => {
      const decl = byName.get(name)
      const page = decl ? router.get({ id: decl.id }) : undefined
      return page ? linkFor(page.slug, cx) : undefined
    },
  }
  return cx
}

/** Pages in sidebar order, then any page the sidebar omits, so nothing is lost. */
const ordered = (cx: Context): PageNode[] => {
  const seen = new Set<string>()
  const out: PageNode[] = []
  for (const section of sections(cx))
    for (const entry of section.entries) {
      if (seen.has(entry.page.slug)) continue
      seen.add(entry.page.slug)
      out.push(entry.page)
    }
  for (const page of cx.router.items) {
    if (seen.has(page.slug)) continue
    seen.add(page.slug)
    out.push(page)
  }
  return out
}

const markdownFor = (page: PageNode, cx: Context): string =>
  routeToMarkdown(cx.router, page, cx.lookup, cx.slugOf, { inlineMembers: false })

/** A page's one-line description: its declaration summary, or its opening prose. */
const describe = (page: PageNode, cx: Context): string => {
  if (page.kind === 'doc') return summaryText(cx.lookup.byId(page.decl)?.comment)
  if (page.kind === 'component') return ''
  return firstParagraph(page.body.join('\n\n'))
}

const homeSummary = (cx: Context): string => {
  const home = cx.router.get({ slug: cx.router.base || '/' }) ?? cx.router.items[0]
  return home && home.kind === 'page' ? firstParagraph(home.body.join('\n\n')) : ''
}

/** First prose paragraph of a markdown body, flattened to one line. */
const firstParagraph = (body: string): string => {
  const withoutFrontmatter = body.replace(/^---\n[\s\S]*?\n---\n/, '')
  for (const block of withoutFrontmatter.split(/\n\s*\n/)) {
    const text = block.trim()
    if (!text || text.startsWith('#') || text.startsWith('```') || text.startsWith('|') || text.startsWith('>')) continue
    return oneLine(text)
  }
  return ''
}

/** Plain-text preview of a doc comment — the same shape the sidebar summaries use. */
const summaryText = (comment: Reflect.Comment | undefined): string => {
  if (!comment) return ''
  let out = ''
  for (const p of comment.parts) out += p.kind === 'text' ? p.text : (p.text ?? p.target)
  const first = out.split(/\n\s*\n/)[0] ?? ''
  return oneLine(first)
}

const oneLine = (s: string): string =>
  s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
