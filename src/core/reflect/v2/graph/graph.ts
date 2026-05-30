import type * as T from '../types.ts'

export interface Graph {
  root: number
  get(id: number): T.Declaration | undefined
  name(id: number): string | undefined
  parent(id: number): number | undefined
  children(id: number): Iterable<T.Declaration>
  all(): Iterable<T.Declaration>
  roots(): Iterable<T.Declaration>

  update(id: number, decl: Partial<T.Declaration>): boolean
  ref(item: Reference): void
  unref(item: Reference): void
  export(): T.Declaration[]

  state: State
}

type State = {
  root: number
  byId: Map<number, T.Declaration>
  byParent: Map<number, Set<number>>
}

export const createGraph = (state: State): Graph => {
  let _exported: boolean = false
  let references: Map<number, Set<Reference>> = new Map()
  let referenced: Set<number> = new Set()

  const assertNotExported = () => {
    if (_exported) throw new Error('Graph already exported')
  }
  const updateReferences = (from: number, to: number) => {
    const refs = references.get(from)
    if (refs === undefined) return
    for (const ref of refs) {
      ref.id = to
    }
    references.delete(from)
    references.set(to, refs)
    referenced.add(to)
    referenced.delete(from)
  }

  const updateId = (from: number, to: number) => {
    assertNotExported()
    const decl = state.byId.get(from)
    if (!decl) return false

    updateReferences(from, to)
    const c = state.byParent.get(decl.parent)
    c?.delete(from)
    c?.add(to)
    decl.id = to
    return true
  }

  const updateParent = (id: number, parent: number) => {
    assertNotExported()
    const decl = state.byId.get(id)
    if (!decl) return false
    const c1 = state.byParent.get(decl.parent)
    c1?.delete(id)
    decl.parent = parent
    const c2 = state.byParent.get(parent)
    c2?.add(id)
    return true
  }

  const update = (id: number, decl: Partial<T.Declaration>) => {
    assertNotExported()
    const d = state.byId.get(id)
    if (!d) return false
    if ('id' in decl) updateId(id, decl.id!)
    if ('parent' in decl) updateParent(id, decl.parent!)
    for (const key in decl) {
      if (key === 'id' || key === 'parent') continue
      if (key in d) (d as any)[key] = decl[key as keyof T.Declaration]
    }
    return true
  }

  const ref = (item: Reference) => {
    if (!state.byId.has(item.id)) throw new Error(`Declaration ${item.id} not found`)
    let refs = references.get(item.id)
    if (refs === undefined) references.set(item.id, (refs = new Set([])))
    referenced.add(item.id)
    refs.add(item)
    return item
  }

  const unref = (item: Reference): Reference => {
    const refs = references.get(item.id)
    if (refs === undefined) return item
    refs.delete(item)
    if (refs.size === 0) {
      references.delete(item.id)
      referenced.delete(item.id)
    }
    return item
  }

  const exportGraph = () => {
    assertNotExported()

    let declarations: T.Declaration[] = []
    for (const id of [...referenced]) {
      const decl = state.byId.get(id)
      if (decl === undefined) continue
      updateId(id, declarations.length)
      declarations.push(decl)
    }

    _exported = true
    return declarations
  }

  const roots = function* () {
    for (const id of state.byId.keys()) {
      const decl = state.byId.get(id)
      if (decl === undefined) continue
      if (decl.parent === state.root) yield decl
    }
  }

  const children = function* (id: number) {
    for (const child of state.byParent.get(id) ?? EMPTY) yield state.byId.get(child)!
  }

  const all = function* () {
    for (const id of state.byId.keys()) yield state.byId.get(id)!
  }

  return {
    state,
    root: state.root,
    get: (id: number) => state.byId.get(id),
    name: (id: number) => state.byId.get(id)?.name,
    parent: (id: number) => state.byId.get(id)?.parent,
    all,
    roots,
    children,
    update,
    ref,
    unref,
    export: exportGraph,
  }
}

export interface GraphRefStore<T> {
  add(item: T): T
  remove(item: T): boolean
}
export const createRefStore = <T>(
  graph: Graph,
  getId: (item: T) => number | undefined,
  setId: (item: T, id: number) => void,
): GraphRefStore<T> => {
  const refs: Map<T, Reference> = new Map()

  const getRef = (item: T): Reference => {
    const r = refs.get(item)
    if (r) return r
    const n = createRef(idGetter(item), idSetter(item))
    refs.set(item, n)
    return n
  }

  const idGetter =
    (item: T): (() => number) =>
    () =>
      getId(item) as number
  const idSetter =
    (item: T): ((id: number) => void) =>
    (id: number) => {
      setId(item, id)
    }
  return {
    add(item: T) {
      const id = getId(item)
      if (id === undefined) return item
      graph.ref(getRef(item))
      return item
    },
    remove(item: T) {
      const r = refs.get(item)
      if (r === undefined) return false
      refs.delete(item)
      graph.unref(r)
      return true
    },
  }
}

declare const refSymbol: unique symbol
type Reference<T = any> = { [refSymbol]: T; id: number }

const createRef = <T>(getId: () => number, setId: (id: number) => void): Reference<T> =>
  ({
    get id() {
      return getId()
    },
    set id(id: number) {
      setId(id) // <-- missing
    },
  }) as Reference<T>

const EMPTY = new Set<number>()
