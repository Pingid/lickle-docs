import pc from 'picocolors'

import type { PageNode, SidebarNode, GroupedItems, PageSource, Placement, TraceEntry, Parent } from './types.ts'
import type * as Reflect from '../reflect/index.ts'
import { shortOf } from '../naming.ts'

/**
 * Print the resolved site to the console: the flat page list, then the nav tree
 * indented. A dev aid for `ldocs generate --print`. Node-only (picocolors) — do
 * not import from the client bundle.
 */
export const printSite = (
  site: { pages: PageNode[]; sidebar: GroupedItems<SidebarNode>[]; declarations: Reflect.Declaration[] },
  write: (s: string) => void = (s) => process.stdout.write(s),
): void => {
  const line = (s = '') => write(s + '\n')
  const kindById = new Map(site.declarations.map((d) => [d.id, d.kind]))

  line(pc.bold('Pages'))
  for (const p of site.pages) {
    const badge = p.kind === 'doc' ? pc.cyan('doc ') : pc.magenta('page')
    line(`  ${badge} ${p.title.padEnd(28)} ${pc.gray(p.slug)}`)
  }

  line()
  line(pc.bold('Sidebar'))
  const walk = (groups: GroupedItems<SidebarNode>[], depth: number): void => {
    const pad = '  '.repeat(depth + 1)
    for (const g of groups) {
      if (g.group) line(pad + pc.yellow(g.group))
      for (const n of g.items) {
        const label = n.kind === 'doc' ? (n.display ?? n.label) : n.label
        const badge =
          n.kind === 'folder'
            ? pc.gray('▸')
            : n.kind === 'page'
              ? pc.magenta('¶')
              : pc.bold(shortOf(kindById.get(n.id) ?? 'module'))
        const slug = n.kind === 'folder' ? pc.gray('(folder)') : pc.gray(n.slug)
        line(`${pad}${badge} ${label.padEnd(30)} ${slug}`)
        walk(n.children, depth + 1)
      }
    }
  }
  walk(site.sidebar, 0)
}

// ─────────────────────────────────────────────────────────────────────────
// `ldocs why` — which layer decided this, and what it decided
// ─────────────────────────────────────────────────────────────────────────

/**
 * Explain one source's placement: the framework default, then every layer that
 * changed it, then the result. A composed layout is a fold of anonymous
 * functions, so without this the only way to understand an unexpected slug is
 * to bisect the config by hand.
 */
export const printWhy = (
  entry: {
    source: PageSource
    placement: Placement
    trace: TraceEntry[]
    slug?: string
    /** Resolve a parent declaration id to a readable name. */
    nameOf?: (id: Reflect.Id) => string | undefined
  },
  write: (s: string) => void = (s) => process.stdout.write(s),
): void => {
  const line = (s = '') => write(s + '\n')
  const summarize = (p: Placement) => summarizePlacement(p, entry.nameOf)

  line(pc.bold(describe(entry.source)))
  const file = entry.source.kind === 'doc' ? entry.source.decl.raw.sources?.[0]?.file : entry.source.file
  if (file) line(pc.gray(`  ${file}`))
  line()

  const base = entry.trace[0]?.before ?? entry.placement
  line(`  ${pc.gray('default')}  ${summarize(base)}`)
  for (const step of entry.trace) line(`  ${pc.cyan(step.layer.padEnd(20))} ${summarize(step.after)}`)

  line()
  if (entry.placement.page === null) {
    line(`  ${pc.bold('result')}   ${pc.red('excluded')} — no page, no sidebar entry`)
  } else {
    line(`  ${pc.bold('result')}   ${summarize(entry.placement)}`)
    if (entry.slug) line(`  ${pc.bold('slug')}     ${pc.green(entry.slug)}`)
  }
  line()
}

/** A placement on one line: where it attaches, what it's called, how it renders. */
const summarizePlacement = (p: Placement, nameOf?: (id: Reflect.Id) => string | undefined): string => {
  if (p.page === null) return pc.red('excluded')
  const bits = [`${parentOf(p.page.parent, nameOf)} → ${pc.bold(p.page.name)}`]
  if (p.page.slug) bits.push(pc.gray(`slug=${p.page.slug}`))
  if (p.page.group) bits.push(pc.yellow(`bucket=${p.page.group.name}${orderSuffix(p.page.group.order)}`))
  if (p.page.order !== undefined) bits.push(pc.gray(`order=${p.page.order}`))
  if (p.page.render && p.page.render !== 'page') bits.push(pc.magenta(p.page.render))
  if (p.nav?.length === 0) bits.push(pc.gray('nav=none'))
  else if (p.nav && p.nav.length > 1) bits.push(pc.gray(`nav×${p.nav.length}`))
  if (p.aliases?.length) bits.push(pc.gray(`aliases×${p.aliases.length}`))
  return bits.join('  ')
}

const orderSuffix = (order?: number): string => (order === undefined ? '' : `#${order}`)

const parentOf = (parent: Parent, nameOf?: (id: Reflect.Id) => string | undefined): string => {
  if ('root' in parent) return pc.gray('/')
  if ('virtual' in parent) return pc.gray(`[${parent.virtual}]`)
  return pc.gray(nameOf?.(parent.decl) ?? `#${parent.decl}`)
}

const describe = (s: PageSource): string =>
  s.kind === 'doc' ? `${s.decl.kind} ${s.decl.name}` : `${s.kind} page "${s.title}"`
