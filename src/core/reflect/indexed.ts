import { path, type t } from '../../_lib/index.ts'
import type { ScanState } from './state.ts'
import * as T from './types.ts'

export const create = (s: ScanState, entries: { as: string; path: string }[]) =>
  index(s, [roots(entries), treeIndex, referenceIndex, exposerIndex])

export type Index = Roots & TreeIndex & ReferenceIndex & ExposerIndex

/** */
export type Roots = { roots(): Iterable<T.Declaration>; commonDir: () => string }
export const roots =
  (entries: { as: string; path: string }[]): Indexer<Roots> =>
  (b): Roots => {
    const roots = new Map<string, T.Declaration>()
    const byPath = new Map<string, number>()
    let commonDir = ''
    b.init((d) => {
      if (d.kind === 'module' && d.path) {
        byPath.set(d.path, d.id)
        for (const entry of entries) {
          if (d.path === entry.path) {
            roots.set(entry.as, d)
            break
          }
        }
      }
    })
    b.after(() => {
      commonDir = path.common(Array.from(byPath.keys()))
    })
    return { roots: () => roots.values(), commonDir: () => commonDir }
  }

export type TreeIndex = {
  get: (id: number) => T.Declaration | undefined
  children: (id: number) => Iterable<T.Declaration>
  declarations: () => Iterable<T.Declaration>
}
export const treeIndex: Indexer<TreeIndex> = (s): TreeIndex => {
  const byId = new Map<number, T.Declaration>()
  const byParent = new Map<number, Set<number>>()
  s.init((d) => {
    byId.set(d.id, d)
    const parent = d.parent
    let children = byParent.get(parent)
    if (!children) byParent.set(parent, (children = new Set()))
    children.add(d.id)
  })
  const EMPTY = new Set<number>()
  return {
    get: (id) => byId.get(id),
    *children(id) {
      for (const child of byParent.get(id) ?? EMPTY) yield byId.get(child)!
    },
    declarations: () => byId.values(),
  }
}

/** */
export type ReferenceIndex = { referencedIn: (id: number) => Iterable<number> }
export const referenceIndex: Indexer<ReferenceIndex> = (s): ReferenceIndex => {
  const referencedIn = new Map<number, Set<number>>()
  for (const ref of s.references) {
    if (ref.type === 'internal') {
      let refs = referencedIn.get(ref.targetId)
      if (!refs) referencedIn.set(ref.targetId, (refs = new Set()))
      refs.add(ref.owner)
    }
  }
  const EMPTY = new Set<number>()
  return { referencedIn: (id) => referencedIn.get(id) ?? EMPTY }
}

/** Depends on Roots + TreeIndex. */
export type Exposure = { exposer: number; alias?: string }
export type Exposed = { id: number; alias?: string }
export type ExposedModule =
  | { id: number; kind: 'star' }
  | { id: number; kind: 'namespace'; alias: string }
  | { id: number; kind: 'named'; names: {}[] }
  
export type ExposerIndex = {
  exposedBy: (id: number) => Iterable<Exposure>
  exposes: (id: number) => Iterable<Exposed>
  /** Declarations exposed directly (one level) by `exposer`, in exposure order. */
  exposed: (exposer: number) => Iterable<Exposed>
  /**
   * Exposed modules / namespaces. With no argument, every one (deduped by id);
   * with an exposer id, only those exposed directly by that module/namespace.
   */
  modules: (exposer?: number) => Iterable<ExposedModule>
}
export const exposerIndex: Indexer<ExposerIndex, Roots & TreeIndex> = (b, deps) => {
  const exposedBy = new Map<number, Exposure[]>()
  const direct = new Map<number, Exposed[]>()
  const exposedModules = new Map<number, ExposedModule>()
  const modulesByExposer = new Map<number, Map<number, ExposedModule>>()

  const setModule = (exposer: number, m: ExposedModule): void => {
    exposedModules.set(m.id, m)
    let g = modulesByExposer.get(exposer)
    if (!g) modulesByExposer.set(exposer, (g = new Map()))
    g.set(m.id, m)
  }

  // Records id under exposer/alias. Returns whether this (exposer → id) edge
  // is new — used to stop infinite recursion on cycles, NOT to globally
  // dedup, since the same id can be exposed by many exposers.
  const seenEdge = new Set<string>()
  const record = (id: number, exposer: number, alias?: string): boolean => {
    const edge = exposer + ':' + id
    if (seenEdge.has(edge)) return false
    seenEdge.add(edge)

    let by = exposedBy.get(id)
    if (!by) exposedBy.set(id, (by = []))
    by.push({ exposer, alias })

    let list = direct.get(exposer)
    if (!list) direct.set(exposer, (list = []))
    list.push({ id, alias })
    return true
  }

  const expose = (id: number, exposer: number, alias?: string): void => {
    const d = deps.get(id)
    if (!d) return
    if (d.kind === 'export') {
      for (const name of d.names) {
        if (d.star && name.name) {
          const target = deps.get(name.ref)
          if (target?.kind === 'module' || target?.kind === 'namespace') {
            setModule(exposer, { id: name.ref, kind: 'namespace', alias: name.name })
          }
          if (record(name.ref, exposer, name.name)) {
            for (const child of deps.children(name.ref)) expose(child.id, name.ref)
          }
        } else if (d.star) {
          if (deps.get(name.ref)?.kind === 'module') setModule(exposer, { id: name.ref, kind: 'star' })
          for (const child of deps.children(name.ref)) expose(child.id, exposer)
        } else {
          if (deps.get(name.ref)?.kind === 'module') addNamed(exposer, name.ref, name.name)
          expose(name.ref, exposer, name.name)
        }
      }
      return
    }
    if (d.kind === 'namespace') {
      setModule(exposer, { id, kind: 'namespace', alias: alias ?? d.name })
      if (record(id, exposer, alias ?? d.name)) {
        for (const child of deps.children(id)) expose(child.id, id)
      }
      return
    }
    // A re-exported module (`export * as ns from './m'`) nests its members.
    if (d.kind === 'module') {
      if (record(id, exposer, alias ?? d.name)) {
        for (const child of deps.children(id)) expose(child.id, id)
      }
      return
    }
    record(id, exposer, alias ?? d.name)
  }

  // A module pulled in by a plain `export { … }` accumulates its named members.
  const addNamed = (exposer: number, id: number, name: string): void => {
    const m = exposedModules.get(id)
    if (m?.kind === 'named') {
      m.names.push({ name })
      setModule(exposer, m)
    } else {
      setModule(exposer, { id, kind: 'named', names: [{ name }] })
    }
  }

  b.after(() => {
    for (const root of deps.roots()) {
      for (const child of deps.children(root.id)) expose(child.id, root.id)
    }
  })

  const EMPTY_BY: Exposure[] = []
  const EMPTY_EXP: Exposed[] = []
  const exposes = function* (id: number): Iterable<Exposed> {
    for (const e of direct.get(id) ?? EMPTY_EXP) {
      yield e
      yield* exposes(e.id)
    }
  }
  const EMPTY_MODULES = new Map<number, ExposedModule>()
  return {
    exposedBy: (id) => exposedBy.get(id) ?? EMPTY_BY,
    exposes: (id) => exposes(id),
    exposed: (id) => direct.get(id) ?? EMPTY_EXP,
    modules: (exposer) =>
      exposer === undefined ? exposedModules.values() : (modulesByExposer.get(exposer) ?? EMPTY_MODULES).values(),
  }
}

// -------------------------------------------
// -- Little abstraction ----------------
// -------------------------------------------
interface IndexBuilder {
  references: T.Type<'reference'>[]

  init: (cb: (d: T.Declaration) => void) => void
  after: (cb: () => void) => void
}

// An indexer declares its dependencies (Deps) and produces an output (Out).
type Indexer<Out extends {} = {}, Deps extends {} = {}> = (b: IndexBuilder, deps: Deps) => Out

export const index = <const T extends Indexer<any, any>[]>(
  s: ScanState,
  indexers: T,
): t.Compute<t.UnionToIntersection<ReturnType<T[number]>>> => {
  const inits: ((d: T.Declaration) => void)[] = []
  const afters: (() => void)[] = []
  const builder: IndexBuilder = { ...s, init: (cb) => inits.push(cb), after: (cb) => afters.push(cb) }

  // `acc` accumulates results and is passed as `deps` to each subsequent indexer.
  const acc = {} as any
  for (const indexer of indexers) Object.assign(acc, indexer(builder, acc))
  for (const d of s.declarations) for (const init of inits) init(d)
  for (const after of afters) after()

  return acc
}
