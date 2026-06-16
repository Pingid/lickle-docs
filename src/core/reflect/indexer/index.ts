import path from 'node:path'

import type * as T from '../types.ts'
import * as Index from './lib.ts'

export type Options = {
  srcDir: string
  entrypoints: { as: string; path: string }[]
}

export type DeclarationIndex = Tree & Roots & References & ExposerIndex

export const builder = (o: Options) => Index.combine([tree(), roots(o), references(), exposures()])

type Tree = {
  get: <K extends keyof T.DeclarationMap = keyof T.DeclarationMap>(id: number) => T.Declaration<K> | undefined
  children: (id: number) => Iterable<T.Declaration>
  declarations: () => Iterable<T.Declaration>
}

const tree = (): Index.Builder<Tree> => {
  const byId = new Map<number, T.Declaration>()
  const byParent = new Map<number, Set<number>>()
  const EMPTY = new Set<number>()

  return {
    add: (d) => {
      byId.set(d.id, d)
      let children = byParent.get(d.parent)
      if (!children) byParent.set(d.parent, (children = new Set()))
      children.add(d.id)
    },
    build: () => ({
      get: (id) => byId.get(id) as any,
      *children(id) {
        for (const child of byParent.get(id) ?? EMPTY) yield byId.get(child)!
      },
      declarations: () => byId.values(),
    }),
  }
}

type Roots = {
  isRoot: (id: number) => boolean
  rootIndex: (id: number) => number
  rootAlias: (id: number) => { as: string; index: number } | undefined
  roots: () => Iterable<T.Declaration<'module'>>
  commonDir: () => string
  languages: () => string[]
}

const roots = (o: Options): Index.Builder<Roots, { langs: Set<string> }> => {
  const rootIds = new Set<number>()
  const rootIdx = new Map<number, number>()
  const rootsMap = new Map<string, T.Declaration<'module'>>()
  const alias = new Map<number, { as: string; index: number }>()
  const byPath = new Map<string, number>()

  return {
    add: (d) => {
      if (d.kind !== 'module' || !d.path) return
      byPath.set(d.path, d.id)
      for (let i = 0; i < o.entrypoints.length; i++) {
        const entry = o.entrypoints[i]!
        if (path.relative(o.srcDir, entry.path) !== d.path) continue
        rootsMap.set(entry.as, d)
        rootIdx.set(d.id, i)
        alias.set(d.id, { as: entry.as, index: i })
        rootIds.add(d.id)
        break
      }
    },
    build: (b) => ({
      isRoot: (id) => rootIds.has(id),
      rootIndex: (id) => rootIdx.get(id)!,
      rootAlias: (id) => alias.get(id),
      roots: () => rootsMap.values(),
      commonDir: () => common(Array.from(byPath.keys())),
      languages: () => Array.from(b.langs),
    }),
  }
}

type References = { referencedIn: (id: T.Id) => Iterable<T.Id> }

const references = (): Index.Builder<References, { references: T.Type<'reference'>[] }> => ({
  add: () => {},
  build: (b) => {
    const referencedIn = new Map<T.Id, Set<T.Id>>()
    for (const ref of b.references) {
      if (ref.target.type !== 'internal') continue
      let refs = referencedIn.get(ref.target.id)
      if (!refs) referencedIn.set(ref.target.id, (refs = new Set()))
      refs.add(ref.owner)
    }
    const EMPTY = new Set<T.Id>()
    return { referencedIn: (id) => referencedIn.get(id) ?? EMPTY }
  },
})

export type Exposure = { exposer: T.Id; alias?: string }

export type ExposerIndex = {
  isExposed: (id: T.Id) => boolean
  exposures: (id: T.Id) => Exposure[][]
  exposes: (id: T.Id) => Exposure[]
  exposedBy: (id: T.Id) => Exposure[]
}

const exposures = (): Index.Builder<ExposerIndex, Tree & Roots> => {
  const exposedByMap = new Map<T.Id, Exposure[]>()
  const exposesMap = new Map<T.Id, Exposure[]>()

  const seenEdge = new Map<string, boolean>()
  const record = (id: T.Id, exposer: T.Id, alias: string | undefined, typeOnly: boolean): boolean => {
    const edge = exposer + ':' + id
    const prev = seenEdge.get(edge)
    if (prev !== undefined) {
      if (prev && !typeOnly) {
        seenEdge.set(edge, false)
        return true
      }
      return false
    }
    seenEdge.set(edge, typeOnly)

    let items = exposesMap.get(exposer)
    if (!items) exposesMap.set(exposer, (items = []))
    items.push({ exposer: id, alias })

    let by = exposedByMap.get(id)
    if (!by) exposedByMap.set(id, (by = []))
    by.push({ exposer, alias })
    return true
  }

  return {
    add: () => {},
    build: (index) => {
      const members = function* (id: T.Id): Iterable<T.Declaration> {
        for (const child of index.children(id)) if (child.exported) yield child
      }

      const expose = (id: T.Id, exposer: T.Id, alias?: string, typeOnly = false): void => {
        const decl = index.get(id)
        if (!decl) return
        if (decl.kind === 'export') {
          for (const name of decl.names) {
            const t = typeOnly || name.type
            if (name.name) expose(name.ref, exposer, name.name, t)
            else for (const child of members(name.ref)) expose(child.id, exposer, undefined, t)
          }
          return
        }
        if (typeOnly && (decl.kind === 'function' || decl.kind === 'variable')) return
        if (decl.kind === 'namespace' || decl.kind === 'module') {
          if (record(id, exposer, alias ?? decl.name, typeOnly)) {
            for (const child of members(id)) expose(child.id, id, undefined, typeOnly)
          }
          return
        }
        record(id, exposer, alias ?? decl.name, typeOnly)
      }

      for (const root of index.roots()) {
        for (const child of members(root.id)) expose(child.id, root.id)
      }

      const exposures = (id: T.Id, pth: Exposure[] = []): Exposure[][] => {
        const d = exposedByMap.get(id)
        if (!d) return []
        return d.flatMap((e) => (index.isRoot(e.exposer) ? [[e, ...pth]] : exposures(e.exposer, [e, ...pth])))
      }

      return {
        isExposed: (id) => (exposedByMap.get(id)?.length ?? 0) > 0,
        exposures,
        exposes: (id) => exposesMap.get(id) ?? [],
        exposedBy: (id) => exposedByMap.get(id) ?? [],
      }
    },
  }
}

const common = (pths: string[]): string => {
  if (!pths.length) return ''
  const split = pths.map((p) => p.split('/'))
  const first = split[0]!
  let i = 0
  for (; i < first.length; i++) {
    if (!split.every((parts) => parts[i] === first[i])) break
  }
  return first.slice(0, i).join('/')
}
