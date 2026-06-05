import pc from 'picocolors'

import { createClientRoutes } from '../client/index.ts'
import * as reflect from '../../reflect/index.ts'
import type { Route, TypeRef } from '../types.ts'

export const printRoutes = (opts: {
  index: reflect.Index
  routes: Route[]
  sidebar?: boolean
  content?: boolean
  write?: (str: string) => void
}) => {
  const s = printer(opts.index, opts.routes, opts.write)
  if (opts.sidebar !== false) printSidebar(s, opts.routes)
  if (opts.content !== false) printContent(s, opts.routes)
}

const printContent = (s: Styler, routes: Route[]) => {
  const router = createClientRoutes(routes)

  s.l('-'.repeat(40))
  s.l(pc.bold('Routes'))
  s.l('-'.repeat(40))
  for (const route of routes) {
    if (route.title === 'unknown') s.l(pc.red('unknown'), pc.gray(route.slug))

    for (const content of route.body) {
      if (content.kind === 'doc:statement') {
        s.page(content.id, content.alias, route.slug)

        // print members
        for (const group of router.members(content.id)) {
          s.group(group.group)
          for (const module of group.items) {
            s.child().page(module.target, module.alias, module.route.slug)
          }
        }
      }

      if (content.kind === 'doc:referenced' && content.referenced.length > 0) {
        s.referenced(content.referenced)
      }
    }
  }
}

const printSidebar = (s: Styler, routes: Route[]) => {
  const router = createClientRoutes(routes)

  const printSidebar = (s: Styler, route: Route) => {
    const id = route.body.map((b) => (b.kind === 'doc:statement' ? b.id : undefined))[0]!
    s.page(id, route.title, route.slug)

    for (const group of router.sidebar.children(route.slug)) {
      if (group.group !== '') s.group(group.group)
      for (const child of group.items) printSidebar(s.child(), child)
    }
  }

  s.l('-'.repeat(40))
  s.l(pc.bold('Sidebar'))
  s.l('-'.repeat(40))
  for (const e of router.sidebar.roots()) {
    printSidebar(s, e)
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

  const kind = (id: number) => {
    const decl = index.get(id)!
    return pc.bold(SHORTS[decl.kind]!)
  }
  const padName = (name: string) => (d: number) => pc.cyan(name.padEnd(40 - d * tabSize))

  const page = (id: number, alias: string, slug: string) => l(kind(id), padName(alias), pc.gray(slug))
  const group = (group: string) => l(3, pc.yellow(group))

  const route = (id: number) => routes.find((r) => r.body.some((b) => b.kind === 'doc:statement' && b.id === id))!

  const parentId = (id: number) => index.get(id)!.parent
  const referenced = (id: TypeRef[]) => {
    const line = id
      .map((id) =>
        [kind(id.target), [pc.green(route(parentId(id.target)).title), pc.green(id.alias)].join('.')].join(': '),
      )
      .join(', ')
    l(4, pc.gray(`referenced in: [${line}]`))
  }
  const tabSize = 1
  return {
    l,
    page,
    group,
    child: () => printer(index, routes, write, depth + 5),
    referenced,
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
