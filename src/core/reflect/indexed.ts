import { Path, type t } from '../../_lib/index.ts'
import type { ScanState } from './state.ts'
import * as T from './types.ts'

export const create = (s: ScanState, entries: { as: string; path: string }[]) =>
  index(s, [roots(entries), treeIndex(s.root), referenceIndex, exposerIndex, sourceCode(s)])

export type Index = Roots & TreeIndex & ReferenceIndex & ExposerIndex & SourceCode

/** */
export type Roots = {
  roots(): Iterable<T.Declaration<'module'>>
  isRoot(id: number): boolean

  rootAlias(id: number): { as: string; index: number } | undefined
  commonDir: () => string
  modules: () => T.Declaration<'module'>[]
}
export const roots =
  (entries: { as: string; path: string }[]): Indexer<Roots> =>
  (b): Roots => {
    const rootIds = new Set<number>()
    const roots = new Map<string, T.Declaration<'module'>>()
    const alias = new Map<number, { as: string; index: number }>()
    const modules: T.Declaration<'module'>[] = []
    const byPath = new Map<string, number>()
    let commonDir = ''
    b.init((d) => {
      if (d.kind === 'module' && d.path) {
        modules.push(d)
        byPath.set(d.path, d.id)
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i]!
          if (d.path === entry.path) {
            roots.set(entry.as, d)
            alias.set(d.id, { as: entry.as, index: i })
            rootIds.add(d.id)
            break
          }
        }
      }
    })
    b.after(() => {
      commonDir = Path.common(Array.from(byPath.keys()))
    })

    return {
      isRoot: (id: number): boolean => rootIds.has(id),
      rootAlias: (id) => alias.get(id),
      roots: () => roots.values(),
      commonDir: () => commonDir,
      modules: () => modules,
    }
  }

/** */
export type SourceCode = {
  getText: (id: number) => string
  sourceFileText: (id: number) => { file: string; text: string }
}
export const sourceCode =
  (s: ScanState): Indexer<SourceCode> =>
  (): SourceCode => {
    const getText = (id: number): string => {
      const node = s?.symbolsById?.get?.(id)
      if (!node) return ''
      return (node?.declarations ?? [])
        .map((d) => d?.getText())
        .filter((t) => t !== undefined)
        .join('\n')
    }

    const sourceFileText = (id: number) => {
      const node = s?.symbolsById?.get?.(id)
      return {
        get file() {
          return node?.declarations?.[0]?.getSourceFile()?.fileName ?? ''
        },
        get text() {
          return node?.declarations?.[0]?.getSourceFile()?.text ?? ''
        },
      }
    }

    return { getText, sourceFileText }
  }

export type TreeIndex = {
  get: <K extends keyof T.DeclarationMap = keyof T.DeclarationMap>(id: number) => T.Declaration<K> | undefined
  parents: (id: number) => number[]
  children: (id: number) => Iterable<T.Declaration>
  declarations: () => Iterable<T.Declaration>
}
export const treeIndex =
  (rootId: number): Indexer<TreeIndex> =>
  (s): TreeIndex => {
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

    const parents = (id: number): number[] => {
      const decl = byId.get(id)
      if (!decl) return []
      if (decl.parent === rootId) return [id]
      return [...parents(decl.parent), id]
    }
    return {
      parents: parents,
      get: (id) => byId.get(id) as any,
      *children(id) {
        for (const child of byParent.get(id) ?? EMPTY) yield byId.get(child)!
      },
      declarations: () => byId.values(),
    }
  }

/** */
export type ReferenceIndex = {
  referencedIn: (id: number) => Iterable<number>
  references: (id: number) => Iterable<number>
}
export const referenceIndex: Indexer<ReferenceIndex> = (s): ReferenceIndex => {
  const referencedIn = new Map<number, Set<number>>()
  const references = new Map<number, Set<number>>()

  for (const ref of s.references) {
    if (ref.type === 'internal') {
      let refs = referencedIn.get(ref.targetId)
      if (!refs) referencedIn.set(ref.targetId, (refs = new Set()))
      refs.add(ref.owner)

      let refss = references.get(ref.owner)
      if (!refss) references.set(ref.owner, (refss = new Set()))
      refss.add(ref.targetId)
    }
  }
  const EMPTY = new Set<number>()
  return { referencedIn: (id) => referencedIn.get(id) ?? EMPTY, references: (id) => references.get(id) ?? EMPTY }
}

/** Depends on Roots + TreeIndex. */
export type Exposure = { exposer: number; alias?: string }
export type Exposed = { id: number; alias?: string }
export type ExposedModule =
  | { id: number; kind: 'star' }
  | { id: number; kind: 'namespace'; alias: string }
  | { id: number; kind: 'named'; names: {}[] }

export type ExposerIndex = {
  isExposed: (id: number) => boolean
  exposures: (id: number) => Exposure[][]
  exposedBy: (id: number) => Iterable<Exposure>
  exposes: (id: number) => Iterable<Exposed>
  /** Declarations exposed directly (one level) by `exposer`, in exposure order. */
  exposed: (exposer: number) => Exposed[]
  /**
   * Exposed modules / namespaces. With no argument, every one (deduped by id);
   * with an exposer id, only those exposed directly by that module/namespace.
   */
  exposedModules: (exposer?: number) => Iterable<ExposedModule>
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

  // Public members of a module / namespace: exported declarations plus the
  // `export …` statements themselves (which carry re-exports). Internal,
  // non-exported helpers are left out of the exposure graph.
  const members = function* (id: number): Iterable<T.Declaration> {
    for (const child of deps.children(id)) if (child.exported) yield child
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
            for (const child of members(name.ref)) expose(child.id, name.ref)
          }
        } else if (d.star) {
          if (deps.get(name.ref)?.kind === 'module') setModule(exposer, { id: name.ref, kind: 'star' })
          for (const child of members(name.ref)) expose(child.id, exposer)
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
        for (const child of members(id)) expose(child.id, id)
      }
      return
    }
    // A re-exported module (`export * as ns from './m'`) nests its members.
    if (d.kind === 'module') {
      if (record(id, exposer, alias ?? d.name)) {
        for (const child of members(id)) expose(child.id, id)
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
      for (const child of members(root.id)) expose(child.id, root.id)
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

  const exposures = (id: number, pth: Exposure[] = []): Exposure[][] => {
    const d = exposedBy.get(id)
    if (!d) return []
    return d.flatMap((e) => (deps.isRoot(e.exposer) ? [[e, ...pth]] : exposures(e.exposer, [e, ...pth])))
  }

  const isExposed = (id: number): boolean => {
    const d = exposedBy.get(id)
    if (!d) return false
    return d.length > 0
  }

  return {
    isExposed,
    exposures,
    exposedBy: (id) => exposedBy.get(id) ?? EMPTY_BY,
    exposes: (id) => exposes(id),
    exposed: (id) => direct.get(id) ?? EMPTY_EXP,
    exposedModules: (exposer) =>
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
