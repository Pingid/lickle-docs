import type { RouteNode, PageType } from './json.ts'
import * as reflect from '../reflect/v2/index.ts'
import * as path from '../../_lib/path/index.ts'
import * as config from '../../config/load.ts'

type Page = Extract<PageType, { kind: 'module' | 'declaration' }>

export type Options = {
  routes?: RouteNode<Extract<PageType, { kind: 'markdown' }>>[]
  entrypoints?: config.Entry[]
}

export const build = (b: reflect.Graph, opts: Options) => {
  const builder = createRouteBuilder(b, opts.routes)
  const mapped = new Map<string, string>()
  for (const ep of opts.entrypoints ?? []) mapped.set(ep.path, ep.as.replace(/\.\//, ''))

  for (const decl of b.roots()) {
    if (decl.parent !== b.root || !decl.exported || decl.kind !== 'module') continue
    const as = mapped.get(decl.path!)
    const page: PageType = { kind: 'module', id: decl.id, alias: as }
    builder.addRoute({
      label: getName(decl, as),
      slug: getSlug(decl, as),
      page,
      children: [...children(b, builder, decl.id)],
    })
  }

  return builder.export()
}

const children = function* (
  g: reflect.Graph,
  b: RouteBuilder,
  id: number,
  star: boolean = false,
  alias?: string,
): Iterable<RouteNode<Page>> {
  let seen = new Set<number>()
  for (const child of g.children(id)) {
    for (const l of leafRoute(g, b, child.id, star, alias)) {
      if (seen.has(child.id)) continue
      else {
        seen.add(child.id)
        yield l
      }
    }
  }
}

const leafRoute = function* (
  g: reflect.Graph,
  b: RouteBuilder,
  id: number,
  star: boolean = false,
  alias?: string,
): Iterable<RouteNode<Page>> {
  const d = g.get(id)
  if (!d) return
  const label = getName(d, alias)
  const slug = getSlug(d, alias)
  if (d.kind === 'export') {
    if (d.star) return yield* leafRoute(g, b, d.ref, true)
    return yield* leafRoute(g, b, d.ref, false, d.name)
  }
  if (d.kind === 'module' || d.kind === 'namespace') {
    if (star) return yield* children(g, b, id)
    const page: PageType = { kind: 'module', alias: alias ?? label, id }
    yield { label, slug, page, children: [...children(g, b, id, star, alias)] }
  }
  const page: PageType = { kind: 'declaration', id }
  yield { label, slug, page, children: [...children(g, b, id, star, alias)] }
}

const getName = (d: reflect.Declaration, alias?: string) => {
  if (d.kind === 'module') return alias ?? d.name ?? getSlug(d, alias)
  return d.name
}

const getSlug = (d: reflect.Declaration, alias?: string) => {
  if (d.kind === 'module') {
    if (alias) return alias
    const m = d.path!.split('/')
    if (m[m.length - 1]?.startsWith('index')) m.pop()
    if (!m[m.length - 1]) return '/'
    return path.stripExt(m[m.length - 1]!)
  }

  return d.name!
}

// ---------------- Generate Routing utils ----------------

export interface RouteBuilder {
  addRoute(r: RouteNode<Page>): void
  export(): { routes: RouteNode<PageType>[]; declarations: reflect.Declaration[] }
  debug(): void
}

const createRouteBuilder = (
  graph: reflect.Graph,
  other?: RouteNode<Extract<PageType, { kind: 'markdown' }>>[],
): RouteBuilder => {
  const routes: RouteNode<Page>[] = []
  const refs = reflect.graph.createRefStore<Page>(
    graph,
    (r) => r.id,
    (r, id: number) => {
      r.id = id
    },
  )

  const slugs = path.slugMaker()
  for (const r of other ?? []) slugs.add(r.slug)

  const addRoute = (r: RouteNode<Page>) => (trackRoute(r), routes.push(r))
  const exportRoutes = () => ({ routes: [...(other ?? []), ...routes], declarations: graph.export() })
  const debug = () => displayRoutes(routes)

  const trackRoute = (r: RouteNode<Page>, parents: string[] = []) => {
    const seg = r.slug
    r.slug = slugs.uniq([...parents, seg].join('/'))
    refs.add(r.page)
    if (!r.children?.length) return
    for (const child of r.children) trackRoute(child, [...parents, seg])
  }

  return { addRoute, export: exportRoutes, debug }
}

export const displayRoutes = (routes: RouteNode<PageType>[], prefix: string = '') => {
  const kinds = { module: 'M', markdown: '.MD', declaration: 'D' }
  const extra = (r: RouteNode<PageType>) => {
    if (r.page.kind === 'markdown') return ''
    if (r.page.kind === 'module') return ''
    if (r.page.kind === 'declaration') return ''
    return ''
  }
  for (const r of routes) {
    const id = () => (r.page as any)?.id ?? r.label
    console.log(prefix + kinds[r.page.kind] + ' ' + id() + ' ' + r.slug + ' ' + extra(r))
    if (r.children) {
      displayRoutes(r.children, prefix + '  ')
    }
  }
}

export const forEach = (routes: RouteNode<Page>[], callback: (r: RouteNode<Page>) => void) => {
  for (const r of routes) {
    callback(r)
    if (r.children) forEach(r.children, callback)
  }
}
