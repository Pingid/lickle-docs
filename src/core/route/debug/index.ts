import pc from 'picocolors'

import { createRouter, groupItems, type ClientRouter, type GroupedItems, type SidebarRoute } from '../client/index.ts'
import * as reflect from '../../reflect/index.ts'
import type { Route } from '../types.ts'

export const printRoutes = (opts: {
  index: reflect.Index
  prefix: { doc?: string; page?: string }
  items: Route[]
  sidebar?: boolean
  content?: boolean
  write?: (str: string) => void
}) => {
  const s = printer(opts.index, opts.items, opts.write)
  const router = createRouter(opts)

  if (opts.sidebar !== false) printSidebar(s, router)
  if (opts.content !== false) printContent(s, router)
}

const printContent = (s: Styler, router: ClientRouter) => {
  s.l('-'.repeat(40))
  s.l(pc.bold('Routes'))
  s.l('-'.repeat(40))
  for (const route of router.items) {
    if (route.kind === 'page') {
      s.l(pc.bold(route.title), pc.gray(route.slug))
      continue
    }
    if (route.title === 'unknown') s.l(pc.red('unknown'), pc.gray(route.slug))

    s.page(route.decl, route.title, route.slug)

    if (route.links.length > 0) {
      const s2 = s.child()
      s2.section('Members')
      for (const groups of groupItems(route.links, (l) => l.group)) {
        s2.group(groups.group)
        for (const link of groups.items) {
          const route = router.get({ id: link.target })
          if (!route) continue
          s2.child().child().page(link.target, link.alias, route.slug)
        }
      }
    }

    if (route.referenced.length > 0) {
      const s2 = s.child()
      s2.section('Referenced In')
      for (const groups of groupItems(route.referenced, (r) => r.group)) {
        s2.group(groups.group)
        for (const referenced of groups.items) {
          const route = router.get({ id: referenced.target })
          if (!route) continue
          s2.child().child().page(referenced.target, referenced.alias, route.slug)
        }
      }
    }
  }
}

const printSidebar = (s: Styler, router: ClientRouter) => {
  const printSidebarGroup = (s: Styler, group: GroupedItems<SidebarRoute>) => {
    const s2 = s.child()
    if (group.group !== '') s2.group(group.group)
    for (const child of group.items) printSidebar(s2.child(), child)
  }

  const printSidebar = (s: Styler, route: SidebarRoute) => {
    if (route.kind === 'page') return
    s.page(route.decl, route.title, route.slug)
    for (const group of route.children) printSidebarGroup(s, group)
  }

  s.l('-'.repeat(40))
  s.l(pc.bold('Sidebar'))
  s.l('-'.repeat(40))

  for (const e of router.sidebar) {
    printSidebarGroup(s, e)
  }
}

const printer = (index: reflect.Index, routes: Route[], write?: (value: string) => void, depth: number = 0) => {
  const writer = write ?? ((x: string) => process.stdout.write(x))

  type Arg = string | ((d: number) => string) | undefined

  const l: {
    (depth: number, ...args: Arg[]): void
    (...args: Arg[]): void
  } = (...args) => {
    const _args = [...args]
    let _depth = depth
    if (typeof _args[0] === 'number') ((_depth += _args[0]), _args.shift())
    const prfx = '\n' + ' '.repeat(_depth * tabSize)
    if (_args.length === 0) return writer(prfx)
    writer(prfx + _args.map((arg) => (typeof arg === 'function' ? arg(_depth) : (arg?.toString() ?? ''))).join(' '))
  }

  const padName = (name?: string) => (d: number) => pc.cyan((name ?? '').padEnd(40 - d * tabSize))

  const section = (title: string) => (l(), l(pc.gray(pc.bold(title.toUpperCase()) + '-'.repeat(40))))
  const group = (group: string) => l(pc.yellow(group))
  const page = (id: number, alias: string, slug: string) =>
    l(pc.bold(SHORTS[index.get(id)!.kind]!), padName(alias), pc.gray(slug))

  const tabSize = 2
  return {
    index,
    l,
    page,
    group,
    section,
    child: () => printer(index, routes, write, depth + 1),
  }
}

type Styler = ReturnType<typeof printer>

const SHORTS: Record<reflect.Declaration['kind'], string> = {
  module: 'M',
  namespace: 'N',
  variable: 'V',
  function: 'ƒ',
  class: 'C',
  interface: 'I',
  'type-alias': 'T',
  enum: 'E',
  export: 'EXP',
}
