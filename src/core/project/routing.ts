import type { RouteNode, PageType } from './json.ts'
import * as reflect from '../reflect/index.ts'
import * as path from '../../_lib/path/index.ts'
import * as config from '../../config/load.ts'

type Page = 'declaration' | 'module'

export type Options = {
  routes?: RouteNode[]
  entrypoints?: config.Entry[]
}

type RouteContext = {
  graph: reflect.scan2.Graph

  create: (p: { id: number; alias?: string; children?: Iterable<RouteNode<Page>> }) => RouteNode<Page>
}

export const build = (graph: reflect.scan2.Graph, opts: Options) => {
  const cx = createContext(graph, opts)
  const routes = new Array<RouteNode<Page>>()

  for (const decl of graph.roots()) {
    routes.push(cx.create({ id: decl.id, children: children(cx, decl.id) }))
  }

  return routes
}

const children = function* (n: RouteContext, id: number) {
  let seen = new Set<number>()
  for (const child of n.graph.children(id)) {
    for (const r of route(n, child.id)) {
      if (seen.has(child.id)) continue
      else {
        seen.add(child.id)
        yield r
      }
    }
  }
}

const route = function* (
  cx: RouteContext,
  id: number,
  star: boolean = false,
  alias?: string,
): Iterable<RouteNode<Page>> {
  const d = cx.graph.get(id)
  if (!d) return

  if (d.kind === 'export') {
    for (const name of d.names) yield* route(cx, name.ref, false, name.name)
    return
  }

  if (d.kind === 'module' || d.kind === 'namespace') {
    if (star) return yield* children(cx, id)
    yield cx.create({ id, alias, children: children(cx, id) })
    return
  }

  yield cx.create({ id, alias, children: children(cx, id) })
}

const createContext = (graph: reflect.scan2.Graph, opts: Options): RouteContext => {
  const mapped = new Map<string, string>()

  for (const ep of opts.entrypoints ?? []) mapped.set(ep.path, ep.as.replace(/\.\//, ''))

  const mods = new Map<number, { name: string; slug: string; qualified: string }>()
  const srcDir = path.common(Array.from(graph.files())).split('/')
  const reg = new RegExp(`^\/?${srcDir}\/`)

  const pathSegments = (pth: string) => {
    const m = pth.split('/')
    if (m[m.length - 1]?.startsWith('index')) m.pop()
    if (!m[m.length - 1]) return []
    if (m[0] === srcDir[0]) m.shift()
    return m.map((s) => path.stripExt(s))
  }

  const moduleName = (d: reflect.Declaration<'module'>, alias?: string) => {
    if (alias) return alias
    const m = mapped.get(d.path)
    if (m) return m
    return nameFromPath(d.path)
  }

  let parent = 0
  const getFor = (id: number, alias?: string) => {
    const d = graph.get(id)!
    if (d.kind === 'module') {
      if (mods.has(d.id)) return mods.get(d.id)!
      parent = d.id
      const name = moduleName(d, alias)
      const seg = pathSegments(d.path)
      const qualified = seg.join('.').replace(reg, '')
      const slug = seg.join('/').replace(reg, '')
      const md = { name, slug, qualified }
      mods.set(d.id, md)
      return md
    }

    const m = mods.get(parent)!
    return { name: d.name, slug: `${m.slug}/${d.name}`, qualified: `${m.qualified}.${d.name}` }
  }

  return {
    graph,
    create: (p) => {
      const { name, slug } = getFor(p.id, p.alias)
      const children = p.children ? [...p.children] : []
      const kind = graph.get(p.id)?.kind === 'module' ? 'module' : 'declaration'
      const page: PageType<Page> = { kind, id: p.id, alias: p.alias ?? name, qualified: name }
      return { label: name, slug, page, children }
    },
  }
}

const nameFromPath = (pth: string) => {
  const m = pth.split('/')
  if (m[m.length - 1]?.startsWith('index')) m.pop()
  if (!m[m.length - 1]) return '/'
  return path.stripExt(m[m.length - 1]!)
}

export const displayRoutes = (routes: RouteNode[], prefix: string = '') => {
  const kinds = { module: 'M', markdown: '.MD', declaration: 'D' }
  const extra = (r: RouteNode) => {
    if (r.page.kind === 'markdown') return ''
    if (r.page.kind === 'module') return ''
    if (r.page.kind === 'declaration') return ''
    return ''
  }
  for (const r of routes) {
    const id = () => (r.page as any)?.id ?? r.label

    console.log(`${prefix}${kinds[r.page.kind]} ${id()} (${r.slug}) ${extra(r)}      `)
    if (r.children) {
      displayRoutes(r.children, prefix + '  ')
    }
  }
}
