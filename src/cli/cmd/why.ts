import * as cmd from 'cmd-ts'
import pc from 'picocolors'

import type { Diagnostic } from '../../core/diagnostic/index.ts'
import type * as Reflect from '../../core/reflect/index.ts'
import type { PageSource } from '../../core/layout/types.ts'
import { printWhy } from '../../core/layout/debug.ts'
import { Build, Config } from '../../core/index.ts'

/**
 * `ldocs why <query>` — show which layout layer decided a page's placement.
 *
 * A composed layout is a fold of anonymous functions; the site tells you the
 * outcome but never the reason. This re-runs the *same* layout with tracing on
 * and prints each layer that changed the placement, so an unexpected slug or a
 * missing sidebar entry can be traced to the line of config responsible.
 */
export const why = cmd.command({
  name: 'why',
  description: 'Explain how a declaration or page ended up where it did',
  args: {
    query: cmd.positional({
      type: cmd.string,
      displayName: 'query',
      description: 'Declaration name, page title or slug (substring match)',
    }),
    all: cmd.flag({
      long: 'all',
      short: 'a',
      description: 'Explain every match instead of stopping after the first few',
    }),
  },
  handler: async (args) => {
    const dir = process.cwd()
    const diagnostics: Diagnostic[] = []
    const emit = (d: Diagnostic) => diagnostics.push(d)

    const { config, ts } = await Config.load(dir, undefined, emit)
    const indexed = Build.reflect(dir, config, ts, emit)
    const builder = Build.makeBuilder(indexed, config, emit)

    // Build once so every source has its resolved slug — the trace explains the
    // placement, the slug is what the reader actually typed into the browser.
    const site = builder.build()
    const slugByDecl = new Map(site.pages.filter((p) => p.kind === 'doc').map((p) => [p.decl, p.slug]))
    const slugByTitle = new Map(site.pages.filter((p) => p.kind !== 'doc').map((p) => [p.title, p.slug]))

    // Parents print as names rather than declaration ids — the id is an
    // implementation detail the reader has no way to look up. A file module has
    // no meaningful `name`, so it prints as its path.
    const nameOf = (id: number) => {
      const d = indexed.get(id)
      if (!d) return undefined
      return d.kind === 'module' ? ((d as Reflect.Declaration<'module'>).path ?? d.name) : d.name
    }

    const needle = args.query.toLowerCase()
    const matches = builder.sources().filter((s) => matchesQuery(s, needle, slugByDecl, slugByTitle))

    if (!matches.length) {
      console.error(`No declaration or page matching ${JSON.stringify(args.query)}.`)
      console.error(pc.gray('Try a declaration name, a page title, or part of a slug.'))
      process.exitCode = 1
      return
    }

    const LIMIT = 5
    const shown = args.all ? matches : matches.slice(0, LIMIT)
    for (const source of shown) {
      const { trace, placement } = builder.explain(source)
      const slug = source.kind === 'doc' ? slugByDecl.get(source.decl.id) : slugByTitle.get(source.title)
      printWhy({ source, placement, trace, nameOf, ...(slug ? { slug } : {}) })
    }

    if (shown.length < matches.length)
      console.log(pc.gray(`… ${matches.length - shown.length} more match; pass --all to see them.`))
  },
})

const matchesQuery = (
  source: PageSource,
  needle: string,
  slugByDecl: Map<number, string>,
  slugByTitle: Map<string, string>,
): boolean => {
  if (source.kind === 'doc') {
    if (source.decl.name.toLowerCase().includes(needle)) return true
    return (slugByDecl.get(source.decl.id) ?? '').toLowerCase().includes(needle)
  }
  if (source.title.toLowerCase().includes(needle)) return true
  if ((source.slug ?? '').toLowerCase().includes(needle)) return true
  return (slugByTitle.get(source.title) ?? '').toLowerCase().includes(needle)
}
