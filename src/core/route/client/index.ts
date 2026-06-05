import type { ModuleRef, Route, Slug, TypeRef } from '../types.ts'

export { type RouteContext, type Adapter as RouteAdapter, compose } from '../provider/core.ts'
export { groupByKind, groupBy } from '../provider/helpers.ts'

export interface ClientRoutes {
  routes: Route[]
  get(slug: Slug): Route | undefined
  members(id: number): { group: string; items: ({ route: Route } & ModuleRef)[] }[]
  referenced(id: number): { group: string; items: ({ route: Route } & TypeRef)[] }[]
  sidebar: {
    roots: () => Route[]
    children: (slug?: Slug) => { group: string; items: Route[] }[]
  }
}

export const createClientRoutes = (routes: Route[]): ClientRoutes => {
  const _routes = new Map<Slug, Route>()
  const _allmembers = new Map<number, ({ route: Route } & ModuleRef)[]>()
  const _Allreferenced = new Map<number, ({ route: Route } & TypeRef)[]>()
  const _allSidebar = new Map<Slug, Route[]>()
  const ROOT = '/'

  for (const route of routes) {
    _routes.set(route.slug, route)

    if (route.sidebar)
      _allSidebar.set(route.sidebar.parent ?? ROOT, [...(_allSidebar.get(route.sidebar.parent ?? ROOT) ?? []), route])

    for (const body of route.body) {
      if (body.kind === 'doc:statement') {
        for (const module of body.modules) {
          if (!_allmembers.has(module.target)) _allmembers.set(module.target, [])
          _allmembers.set(module.target, [...(_allmembers.get(module.target) ?? []), { ...module, route }])
        }
      }
      if (body.kind === 'doc:referenced') {
        for (const ref of body.referenced) {
          if (!_Allreferenced.has(ref.target)) _Allreferenced.set(ref.target, [])
          _Allreferenced.set(ref.target, [...(_Allreferenced.get(ref.target) ?? []), { ...ref, route }])
        }
      }
    }
  }

  const _members = new Map<number, { group: string; items: ({ route: Route } & ModuleRef)[] }[]>()
  for (const [id, members] of _allmembers.entries()) {
    const groups = new Map<string, { order: number; items: ({ route: Route } & ModuleRef)[] }>()
    for (const member of members) {
      const name = member.group?.name ?? ''
      if (!groups.has(name)) groups.set(name, { order: member.group?.order ?? 0, items: [] })
      groups.get(name)!.items.push(member)
    }

    for (const [name, group] of groups.entries()) {
      groups.set(name, { ...group, items: group.items.sort((a, b) => (a.group?.order ?? 0) - (b.group?.order ?? 0)) })
    }
    _members.set(
      id,
      [...groups.entries()].map(([name, group]) => ({ group: name, items: group.items })),
    )
  }

  const _referenced = new Map<number, { group: string; items: ({ route: Route } & TypeRef)[] }[]>()
  for (const [id, members] of _Allreferenced.entries()) {
    const groups = new Map<string, { order: number; items: ({ route: Route } & TypeRef)[] }>()
    for (const member of members) {
      const name = member.group?.name ?? ''
      if (!groups.has(name)) groups.set(name, { order: member.group?.order ?? 0, items: [] })
      groups.get(name)!.items.push(member)
    }

    for (const [name, group] of groups.entries()) {
      groups.set(name, { ...group, items: group.items.sort((a, b) => (a.group?.order ?? 0) - (b.group?.order ?? 0)) })
    }
    _referenced.set(
      id,
      [...groups.entries()].map(([name, group]) => ({ group: name, items: group.items })),
    )
  }

  const _sidebar = new Map<Slug, { group: string; items: Route[] }[]>()
  for (const [id, items] of _allSidebar.entries()) {
    const groups = new Map<string, { order: number; items: Route[] }>()

    for (const item of items) {
      const name = item.sidebar?.group?.name ?? ''
      if (!groups.has(name)) groups.set(name, { order: item.sidebar?.group?.order ?? 0, items: [] })
      groups.get(name)!.items.push(item)
    }

    for (const [name, group] of groups.entries()) {
      groups.set(name, {
        ...group,
        items: group.items.sort((a, b) => (a.sidebar?.group?.order ?? 0) - (b.sidebar?.group?.order ?? 0)),
      })
    }
    _sidebar.set(
      id,
      [...groups.entries()].map(([name, group]) => ({ group: name, items: group.items })),
    )
  }

  return {
    routes: Array.from(_routes.values()),
    get: (slug: Slug) => _routes.get(slug),
    members: (id: number) => _members.get(id) ?? [],
    referenced: (id: number) => _referenced.get(id) ?? [],
    sidebar: {
      children: (slug?: Slug) => _sidebar.get(slug ?? ROOT) ?? [],
      roots: () => _allSidebar.get(ROOT) ?? [],
    },
  }
}
