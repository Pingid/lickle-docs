import type * as resolve from './resolver.ts'
import type * as T from './types.ts'
import * as walk from './walk.ts'

/**
 * Schema produced after running `build`. Extends the resolved schema by
 * attaching navigation handles (`$`) and resolved object pointers for
 * type references and exports clauses.
 *
 * Anything reachable via plain field access is a forward edge that was set
 * during indexing. Anything reachable via `$` is a reverse edge or computed
 * lookup — these are methods even when O(1) so the cost story is honest.
 */
export interface Registry extends T.TypeRegistry {
  declarations: DeclarationMap
  types: TypeMap
}

export interface DeclarationMap extends T.DeclarationMap<Registry> {
  module: Module
  variable: T.Variable<Registry> & WithQuery<DeclarationQueries>
  function: T.Func<Registry> & WithQuery<DeclarationQueries>
  class: T.Class<Registry> & WithQuery<DeclarationQueries>
  interface: T.Interface<Registry> & WithQuery<DeclarationQueries>
  'type-alias': TypeAlias
  enum: T.Enum<Registry> & WithQuery<DeclarationQueries>
  namespace: Namespace
  exports: Exports
}

export type Declaration<K extends keyof DeclarationMap = keyof DeclarationMap> = DeclarationMap[K]

interface TypeMap extends T.TypeMap<Registry> {
  reference: Reference
}
export type Type<K extends keyof TypeMap = keyof TypeMap> = TypeMap[K]

// ============================================================================
// QUERY HANDLES
// ============================================================================

/**
 * Every navigable node carries a `$` property. The name is short on purpose:
 * `decl.$.referencedBy()` keeps the verb at the end where the eye lands, and
 * leaves the data fields uncluttered.
 *
 * `$` is non-enumerable at runtime, so `JSON.stringify(project)` still
 * produces clean output (no methods, no parent-pointer cycles).
 */
interface WithQuery<Q> {
  readonly $: Q
}

/**
 * Reverse-edge queries available on every declaration. Methods rather than
 * getters because the first call to any reverse query may trigger a full
 * project walk to populate the cache; subsequent calls are O(1) lookup.
 *
 * The `module` getter is the exception — it's set during forward indexing,
 * so a property-style read is honest about cost.
 */
export interface DeclarationQueries {
  /** Enclosing scope — a file `Module` or a TS `Namespace`. Set during forward indexing. */
  readonly module: Scope

  /**
   * Every in-project `reference` type whose `target` is this declaration.
   * Excludes references in re-export clauses (those live in `exportedBy`).
   */
  referencedBy(): Iterable<Reference>

  /** Every `Exports` clause whose `names` references this declaration. */
  exportedBy(): Iterable<Exports>
}

/** Scope queries — a Module or Namespace. */
export interface ScopeQueries extends DeclarationQueries {
  /**
   * Every `Exports` / `Namespace` whose source module is this scope. The
   * inverse of `Exports.sourceModuleRef`.
   */
  importedBy(): Iterable<Exports>

  /**
   * Lookup by exposed name. Walks `childDecls`: for `Exports` children
   * each `names[].name` keys to the resolved target; everything else
   * keys to its own `name`.
   */
  declarationByName(name: string): T.AnyDeclaration<Registry> | undefined
}

/** Reference-specific lookup: the enclosing declaration where this ref appears. */
export interface ReferenceQueries {
  /**
   * The nearest declaration that contains this reference. Set during
   * forward indexing.
   */
  readonly enclosingDeclaration: T.AnyDeclaration<Registry>
}

/** A scope is anything that owns child declarations: a file Module or a TS Namespace. */
export type Scope = Module | Namespace

// ============================================================================
// SPECIALIZED NODE TYPES
// ============================================================================

export interface Module extends T.Module<Registry>, WithQuery<ScopeQueries> {
  /**
   * The owning project. Lets you walk back up to global indexes without
   * threading state through queries.
   */
  readonly project: Indexed
  /** Always undefined — file modules are top-level. */
  readonly parentModule?: undefined
  /** Resolved children — non-enumerable, hidden from JSON. */
  readonly childDecls: ReadonlyArray<T.AnyDeclaration<Registry>>
}

export interface Namespace extends T.Namespace<Registry>, WithQuery<ScopeQueries> {
  readonly project: Indexed
  /** The enclosing module or namespace block. */
  readonly parentModule?: Scope
  /** Resolved children — non-enumerable, hidden from JSON. */
  readonly childDecls: ReadonlyArray<T.AnyDeclaration<Registry>>
}

export interface TypeAlias extends T.TypeAlias<Registry>, WithQuery<DeclarationQueries> {
  /** Resolved alias body for simple `type Foo = Bar` cases. */
  readonly target?: T.AnyDeclaration<Registry>
}

export interface Exports extends T.Exports<Registry>, WithQuery<DeclarationQueries> {
  /** Resolved targets, one per `names[]` entry, in the same order. */
  readonly targets: ReadonlyArray<T.AnyDeclaration<Registry>>
  /** Derived: source module for the clause (enclosing module for `export { x }`, the `from` target otherwise). */
  readonly sourceModuleRef?: Module
}

export interface Reference extends T.ReferenceType<Registry>, WithQuery<ReferenceQueries> {
  /** Resolved target declaration. Undefined for external references. */
  readonly target?: T.AnyDeclaration<Registry>
}

export type Source = T.Source
export type Routable = T.Routable
export type Variable = T.Variable<Registry>
export type Func = T.Func<Registry>
export type Class = T.Class<Registry>
export type Interface = T.Interface<Registry>
export type Enum = T.Enum<Registry>
export type EnumMember = T.EnumMember
export type Property = T.Property<Registry>
export type Method = T.Method<Registry>
export type IndexSignature = T.IndexSignature<Registry>
export type Signature = T.Signature<Registry>
export type Parameter = T.Parameter<Registry>
export type TypeParameter = T.TypeParameter<Registry>
export type IntrinsicType = T.IntrinsicType
export type LiteralType = T.LiteralType
export type ReferenceType = T.ReferenceType<Registry>
export type UnionType = T.UnionType<Registry>
export type IntersectionType = T.IntersectionType<Registry>
export type ArrayType = T.ArrayType<Registry>
export type TupleType = T.TupleType<Registry>
export type TupleElement = T.TupleElement<Registry>
export type FunctionType = T.FunctionType<Registry>
export type TypeOperatorType = T.TypeOperatorType<Registry>
export type QueryType = T.QueryType<Registry>
export type ReflectionType = T.ReflectionType<Registry>
export type ObjectLiteral = T.ObjectLiteral<Registry>
export type Comment = T.Comment<Registry>
export type CommentTag = T.CommentTag<Registry>
export type CommentTagMap = T.CommentTagMap<Registry>
export type CommentPart = T.CommentPart

// ============================================================================
// PROJECT HANDLE
// ============================================================================

/** Global indexes exposed at the project level. */
export interface Indexed {
  readonly declarationsById: ReadonlyMap<number, T.AnyDeclaration<Registry>>
  readonly idBySlug: ReadonlyMap<string, number>
  readonly slugById: ReadonlyMap<number, string>
  readonly qualifiedNameById: ReadonlyMap<number, string>
  readonly slugByName: ReadonlyMap<string, string>
  readonly allReferences: ReadonlyArray<Reference>

  /** Top-level modules (one per scanned source file), in input order. */
  modules(): ReadonlyArray<Module>
  declarationById(id: number): T.AnyDeclaration<Registry> | undefined
  declarationByQualifiedName(name: string): T.AnyDeclaration<Registry> | undefined
  referenceById(id: number): Reference | undefined
}

/**
 * Wrap a resolved flat schema with navigation handles. Mutates the input —
 * after calling, the same objects satisfy `Registry` instead of
 * `resolve.Registry`. Callers who need both views should clone first.
 */
export const build = (declarations: T.AnyDeclaration<resolve.Registry>[], topIds: number[]): Indexed => {
  const proj = {} as Indexed
  const decls = declarations as unknown as AnyDecl[]
  const state: State = {
    proj,
    declarationsById: new Map(decls.map((d) => [idOf(d), d])),
    idBySlug: new Map(),
    slugById: new Map(),
    qualifiedNameById: new Map(),
    allReferences: [],
    topModules: [],
  }

  // Forward indexes (slug, qualified name) come straight off the decls.
  for (const decl of decls) {
    const slug = (decl as { slug?: string }).slug
    const qn = (decl as { qualifiedName?: string }).qualifiedName
    if (slug) {
      state.slugById.set(idOf(decl), slug)
      state.idBySlug.set(slug, idOf(decl))
    }
    if (qn) state.qualifiedNameById.set(idOf(decl), qn)
  }

  // Parent-by-child: walk every container's `children` once.
  const parentByChild = new Map<number, Scope>()
  for (const decl of decls) {
    if (decl.kind !== 'module' && decl.kind !== 'namespace') continue
    for (const cid of decl.children) {
      if (!parentByChild.has(cid)) parentByChild.set(cid, decl as Scope)
    }
  }

  // Attach `$` and parentModule to every container; record top modules.
  for (const id of topIds) {
    const mod = state.declarationsById.get(id)
    if (mod && mod.kind === 'module') state.topModules.push(mod as Module)
  }
  for (const decl of decls) {
    if (decl.kind === 'module') {
      hide(decl, 'project', state.proj)
      hide(decl, '$', makeScopeQueries(decl as Scope, state))
      continue
    }
    if (decl.kind === 'namespace') {
      hide(decl, 'project', state.proj)
      const parent = parentByChild.get(decl.id)
      if (parent) hide(decl, 'parentModule', parent)
      hide(decl, '$', makeScopeQueries(decl as Scope, state))
      continue
    }
    const parent = parentByChild.get(decl.id)
    hide(decl, '$', makeDeclarationQueries(decl, parent, state))
  }

  // References: walk every decl once, collect references with enclosing decl.
  for (const decl of decls) {
    walk.Declaration(decl as T.AnyDeclaration, {
      onReference: (ref) => {
        const r = ref as Reference
        state.allReferences.push(r)
        hide(r, '$', { enclosingDeclaration: decl } satisfies ReferenceQueries)
      },
      onExports: () => {
        // Exports resolution happens in the next pass once $.module is set.
      },
    })
  }

  // Forward edge resolution.
  for (const ref of state.allReferences) {
    const tid = (ref as Reference & { targetId?: number }).targetId
    if (tid === undefined) continue
    const target = state.declarationsById.get(tid)
    if (target) hide(ref, 'target', target)
  }
  for (const decl of decls) {
    if (decl.kind === 'exports') resolveExports(decl, state)
    else if (decl.kind === 'type-alias') resolveTypeAlias(decl)
  }

  attachProjectMethods(state)
  return proj
}

// ============================================================================
// INTERNAL STATE
// ============================================================================

type AnyDecl = T.AnyDeclaration<Registry>

interface State {
  proj: Indexed
  declarationsById: Map<number, AnyDecl>
  idBySlug: Map<string, number>
  slugById: Map<number, string>
  qualifiedNameById: Map<number, string>
  allReferences: Reference[]
  topModules: Module[]
  referencedBy?: Map<number, Reference[]>
  exportedBy?: Map<number, Exports[]>
  importedBy?: Map<number, Exports[]>
  declByName?: Map<number, Map<string, AnyDecl>>
  refById?: Map<number, Reference>
  declByQName?: Map<string, AnyDecl>
  slugByName?: Map<string, string>
}

const hide = (obj: object, key: string, value: unknown): void => {
  Object.defineProperty(obj, key, { value, enumerable: false, configurable: true })
}

const idOf = (d: AnyDecl): number => (d as T.Base<any>).id

// ============================================================================
// FORWARD EDGE RESOLUTION
// ============================================================================

const resolveExports = (exp: Exports, state: State): void => {
  const targets = exp.names.map((n) => state.declarationsById.get(n.id)).filter((d): d is AnyDecl => !!d)
  hide(exp, 'targets', targets)
  // sourceModuleRef: if any target is itself a Module, it IS the source
  // (the `export * as foo from './x'` shape). Otherwise climb to the
  // module that contains the first target.
  const first = targets[0]
  if (!first) return
  if (first.kind === 'module') {
    hide(exp, 'sourceModuleRef', first)
    return
  }
  const scope = (first as { $?: DeclarationQueries }).$?.module
  const mod = scope ? topModuleOf(scope) : undefined
  if (mod) hide(exp, 'sourceModuleRef', mod)
}

const topModuleOf = (scope: Scope): Module => {
  let cur: Scope = scope
  while (cur.kind === 'namespace' && cur.parentModule) cur = cur.parentModule
  return cur as Module
}

const resolveTypeAlias = (alias: TypeAlias): void => {
  if (alias.type.kind !== 'reference') return
  const target = (alias.type as Reference).target
  if (target) hide(alias, 'target', target)
}

// ============================================================================
// QUERY FACTORIES
// ============================================================================

const ABSENT_SCOPE: Scope = {} as Scope

const makeDeclarationQueries = (decl: AnyDecl, scope: Scope | undefined, state: State): DeclarationQueries => ({
  module: scope ?? ABSENT_SCOPE,
  referencedBy: () => referencedByMap(state).get(idOf(decl)) ?? [],
  exportedBy: () => exportedByMap(state).get(idOf(decl)) ?? [],
})

const makeScopeQueries = (scope: Scope, state: State): ScopeQueries => ({
  module: scope,
  referencedBy: () => referencedByMap(state).get(scope.id) ?? [],
  exportedBy: () => exportedByMap(state).get(scope.id) ?? [],
  importedBy: () => importedByMap(state).get(scope.id) ?? [],
  declarationByName: (name) => moduleDeclByName(scope, state).get(name),
})

// ============================================================================
// LAZY REVERSE CACHES
// ============================================================================

const referencedByMap = (state: State): Map<number, Reference[]> => {
  if (state.referencedBy) return state.referencedBy
  const map = new Map<number, Reference[]>()
  for (const ref of state.allReferences) {
    if (!ref.target) continue
    const id = idOf(ref.target)
    const arr = map.get(id)
    if (arr) arr.push(ref)
    else map.set(id, [ref])
  }
  return (state.referencedBy = map)
}

const exportedByMap = (state: State): Map<number, Exports[]> => {
  if (state.exportedBy) return state.exportedBy
  const map = new Map<number, Exports[]>()
  for (const decl of state.declarationsById.values()) {
    if (decl.kind !== 'exports') continue
    for (const target of decl.targets) {
      const id = idOf(target)
      const arr = map.get(id)
      if (arr) arr.push(decl)
      else map.set(id, [decl])
    }
  }
  return (state.exportedBy = map)
}

const importedByMap = (state: State): Map<number, Exports[]> => {
  if (state.importedBy) return state.importedBy
  const map = new Map<number, Exports[]>()
  for (const decl of state.declarationsById.values()) {
    if (decl.kind !== 'exports' || !decl.sourceModuleRef) continue
    const arr = map.get(decl.sourceModuleRef.id)
    if (arr) arr.push(decl)
    else map.set(decl.sourceModuleRef.id, [decl])
  }
  return (state.importedBy = map)
}

/**
 * Per-scope name → declaration map. Walks the scope's `childDecls`. For
 * `Exports` children, each `names[].name` keys to the resolved target.
 * Other children key to their own `name`.
 */
const moduleDeclByName = (scope: Scope, state: State): Map<string, AnyDecl> => {
  if (!state.declByName) state.declByName = new Map()
  const cached = state.declByName.get(scope.id)
  if (cached) return cached
  const map = new Map<string, AnyDecl>()
  for (const child of scope.childDecls) {
    if (child.kind === 'exports') {
      for (let i = 0; i < child.names.length; i++) {
        const target = child.targets[i]
        if (target) map.set(child.names[i]!.name, target)
      }
      continue
    }
    const n = (child as { name?: string }).name
    if (n) map.set(n, child)
  }
  state.declByName.set(scope.id, map)
  return map
}

// ============================================================================
// PROJECT-LEVEL HELPERS
// ============================================================================

const attachProjectMethods = (state: State): void => {
  const p = state.proj
  hide(p, 'declarationsById', state.declarationsById)
  hide(p, 'slugById', state.slugById)
  hide(p, 'idBySlug', state.idBySlug)
  hide(p, 'qualifiedNameById', state.qualifiedNameById)
  hide(p, 'allReferences', state.allReferences)
  hide(p, 'modules', () => state.topModules)
  hide(p, 'declarationById', (id: number) => state.declarationsById.get(id))
  hide(p, 'referenceById', (id: number) => refByIdMap(state).get(id))
  hide(p, 'declarationByQualifiedName', (name: string) => declByQNameMap(state).get(name))
  Object.defineProperty(p, 'slugByName', {
    get: () => slugByNameMap(state),
    enumerable: false,
    configurable: true,
  })

  // Hide childDecls on every container.
  for (const decl of state.declarationsById.values()) {
    if (decl.kind === 'module' || decl.kind === 'namespace') {
      const resolved = decl.children.map((id) => state.declarationsById.get(id)).filter((d): d is AnyDecl => !!d)
      hide(decl, 'childDecls', resolved)
    }
  }
}

const refByIdMap = (state: State): Map<number, Reference> => {
  if (state.refById) return state.refById
  const map = new Map<number, Reference>()
  for (const ref of state.allReferences) map.set(ref.id, ref)
  return (state.refById = map)
}

const slugByNameMap = (state: State): Map<string, string> => {
  if (state.slugByName) return state.slugByName
  const map = new Map<string, string>()
  const bare: { name: string; depth: number; slug: string }[] = []
  for (const decl of state.declarationsById.values()) {
    const slug = state.slugById.get(idOf(decl))
    if (!slug) continue
    const name = (decl as { name?: string }).name
    if (!name) continue
    const qn = state.qualifiedNameById.get(idOf(decl)) ?? name
    map.set(qn, slug)
    bare.push({ name, depth: qn.split('.').length, slug })
  }
  bare.sort((a, b) => a.depth - b.depth)
  for (const { name, slug } of bare) if (!map.has(name)) map.set(name, slug)
  return (state.slugByName = map)
}

const declByQNameMap = (state: State): Map<string, AnyDecl> => {
  if (state.declByQName) return state.declByQName
  const map = new Map<string, AnyDecl>()
  const bare: { name: string; depth: number; decl: AnyDecl }[] = []
  for (const decl of state.declarationsById.values()) {
    if (decl.kind === 'module' || decl.kind === 'exports') continue
    const name = (decl as { name?: string }).name
    if (!name) continue
    const scope = (decl as { $?: DeclarationQueries }).$?.module
    if (!scope) continue
    const qn = qualify(scope, name)
    map.set(qn, decl)
    bare.push({ name, depth: qn.split(/[:.]/).length, decl })
  }
  bare.sort((a, b) => a.depth - b.depth)
  for (const { name, decl } of bare) if (!map.has(name)) map.set(name, decl)
  return (state.declByQName = map)
}

const qualify = (scope: Scope, name: string): string => {
  const parts: string[] = [name]
  let cur: Scope = scope
  while (cur.kind === 'namespace' && cur.parentModule) {
    if (cur.name) parts.unshift(cur.name)
    cur = cur.parentModule
  }
  const top = (cur as Module).path ?? (cur as { name?: string }).name ?? ''
  return top ? `${top}:${parts.join('.')}` : parts.join('.')
}
