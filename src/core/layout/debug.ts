import pc from 'picocolors'

import { shortOf } from '../naming.ts'
import type * as Reflect from '../reflect/index.ts'
import type { PageNode, SidebarNode, GroupedItems } from './types.ts'

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
