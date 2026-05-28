import * as modulePath from './module-path.ts'
import type * as resolve from './resolve.ts'
import type * as T from './types.ts'
import * as walk from './walk.ts'

/**
 * Schema produced after running `indexProject`. Extends the resolved schema
 * by attaching navigation handles (`$`) and replacing numeric ids on
 * references and re-exports with direct object pointers.
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
  're-export': ReExport
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
  /** Enclosing module. Set during forward indexing. */
  readonly module: Module

  /**
   * Every in-project `reference` type whose `target` is this declaration.
   * Excludes references in re-export clauses (those live in `reExportedBy`).
   *
   * Returns an iterable so callers can short-circuit (`for...of` with break,
   * `Array.from(...).slice(0, 10)`). Use `[...decl.$.referencedBy()]` if you
   * want a concrete array.
   */
  referencedBy(): Iterable<Reference>

  /** Every `re-export` declaration whose `targets` includes this declaration. */
  reExportedBy(): Iterable<ReExport>
}

/** Module-specific queries on top of the declaration ones. */
export interface ModuleQueries extends DeclarationQueries {
  /**
   * Re-exports anywhere in the project whose `sourceModuleRef` resolves to
   * this module. The inverse of `ReExport.sourceModuleRef`.
   */
  importedBy(): Iterable<ReExport>

  /**
   * Lookup by exported name. Includes declarations defined locally *and*
   * names brought in by `export *` (resolved via the re-export's targets).
   * For `export { foo as bar }`, the key is the external name (`bar`).
   */
  declarationByName(name: string): T.AnyDeclaration<Registry> | undefined
}

/** Reference-specific lookup: the enclosing declaration where this ref appears. */
export interface ReferenceQueries {
  /**
   * The nearest declaration that contains this reference. For a reference in
   * a function parameter's type, this is the `function`, not the `signature`.
   * Set during forward indexing.
   */
  readonly enclosingDeclaration: T.AnyDeclaration<Registry>
}

// ============================================================================
// SPECIALIZED NODE TYPES
// ============================================================================

export interface Module extends T.Module<Registry>, WithQuery<ModuleQueries> {
  /**
   * The owning project. Set during forward indexing. Lets you walk back up
   * to global indexes (`module.project.declarationsById`) without threading
   * state through queries.
   */
  readonly project: Indexed

  /**
   * Set when this module is a TypeScript namespace nested inside another
   * module (`namespace Foo { … }` inside a source file). Undefined for
   * top-level source files.
   */
  readonly parentModule?: Module
}

export interface TypeAlias extends T.TypeAlias<Registry>, WithQuery<DeclarationQueries> {
  /**
   * Resolved alias body for simple `type Foo = Bar` cases — the declaration
   * that `Bar` points at. Undefined when the alias body isn't a single
   * reference (unions, intersections, computed types). For those, walk
   * `this.type` directly.
   */
  readonly target?: T.AnyDeclaration<Registry>
}

/**
 * One indexed re-export per discriminated form. The base shape is the
 * scanned `ReExport`; the indexed view adds resolved `targets` and an
 * optional `sourceModuleRef` pointing at the in-project source module.
 */
export type ReExport = ReExportAll | ReExportNamespace | ReExportNamed

export interface ReExportAll extends T.ReExportAll<Registry>, WithQuery<DeclarationQueries> {
  readonly targets: ReadonlyArray<T.AnyDeclaration<Registry>>
  readonly sourceModuleRef?: Module
}

export interface ReExportNamespace extends T.ReExportNamespace<Registry>, WithQuery<DeclarationQueries> {
  readonly targets: ReadonlyArray<T.AnyDeclaration<Registry>>
  readonly sourceModuleRef?: Module
}

export interface ReExportNamed extends T.ReExportNamed<Registry>, WithQuery<DeclarationQueries> {
  readonly targets: ReadonlyArray<T.AnyDeclaration<Registry>>
  readonly sourceModuleRef?: Module
}

export interface Reference extends T.ReferenceType<Registry>, WithQuery<ReferenceQueries> {
  /**
   * Resolved target declaration. Undefined for external references
   * (e.g. `Array<T>`, `Promise<U>`). Replaces the `targetId: number` from
   * `ResolvedRegistry` — same information, but a direct pointer so the
   * common case (`ref.target?.name`) doesn't need a map lookup.
   */
  readonly target?: T.AnyDeclaration<Registry>
}

export type Source = T.Source
export type Routable = T.Routable
export type NamedExport = T.NamedExport
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

/**
 * Global indexes exposed at the project level. Forward indexes
 * (`declarationsById`, `slugById`, `idBySlug`, `qualifiedNameById`) are
 * built eagerly from the precomputed naming fields. Reverse indexes
 * (`allReferences`, `slugByName`, the maps backing `$.referencedBy()` etc.)
 * are built lazily on first access and cached for the lifetime of the
 * project.
 */
export interface Indexed {
  /** Every declaration in the project keyed by its reflection id. */
  readonly declarationsById: ReadonlyMap<number, T.AnyDeclaration<Registry>>

  /** Slug → id. */
  readonly idBySlug: ReadonlyMap<string, number>

  /** Id → slug. Same data, indexed in the more common direction. */
  readonly slugById: ReadonlyMap<number, string>

  /** Id → fully qualified dotted name (`models.User`, `Foo.Inner.Bar`). */
  readonly qualifiedNameById: ReadonlyMap<number, string>

  /**
   * Bare or qualified name → slug. Built lazily; bare-name entries resolve
   * to the shallowest matching declaration.
   */
  readonly slugByName: ReadonlyMap<string, string>

  /**
   * Every `reference` type in the project, in walk order. Cheap to expose
   * because it's the same array that backs `$.referencedBy()` lookups.
   */
  readonly allReferences: ReadonlyArray<Reference>

  /** Top-level modules (one per scanned source file), in input order. */
  modules(): ReadonlyArray<Module>

  /**
   * Find a declaration by stable id. Mostly a convenience over
   * `declarationsById.get(id)`.
   */
  declarationById(id: number): T.AnyDeclaration<Registry> | undefined

  /**
   * Look up a declaration by its fully-qualified name, e.g. "User" or
   * "src/models.ts:User" or "MyNamespace.Inner". Returns undefined if
   * not found. O(1) after the first call (lazily indexed).
   */
  declarationByQualifiedName(name: string): T.AnyDeclaration<Registry> | undefined

  /**
   * Look up the reference site by its id. Mostly useful when an external
   * system (a serialized graph, a doc index) hands you a raw id.
   */
  referenceById(id: number): Reference | undefined
}

/**
 * Wrap a resolved project with navigation handles. Mutates the input —
 * after calling, the same objects satisfy `Registry` instead of
 * `ResolvedRegistry`. Callers who need both views should clone first.
 *
 * The forward pass (parent pointers, `declarationsById`, attaching `$`)
 * runs synchronously here. Reverse indexes are built on first access.
 */
export const build = (modules: T.Module<resolve.Registry>[]): Indexed => {
  const proj = {} as Indexed
  const state: State = {
    proj,
    declarationsById: new Map(),
    idBySlug: new Map(),
    slugById: new Map(),
    qualifiedNameById: new Map(),
    allReferences: [],
    topModules: [],
    topModulesByLabel: new Map(),
    declByName: new Map(),
  }
  for (const mod of modules as unknown as Module[]) {
    state.topModules.push(mod)
    state.topModulesByLabel.set(modulePath.label(mod), mod)
    indexModule(mod, undefined, state)
  }
  resolveForwardEdges(state)
  attachProjectMethods(state)
  return proj
}

// ============================================================================
// INTERNAL STATE
// Shared by every `$` closure. Forward-edge maps are populated eagerly; the
// rest are lazy caches keyed off declaration / module ids.
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
  topModulesByLabel: Map<string, Module>
  declByName: Map<number, Map<string, AnyDecl>>
  referencedBy?: Map<number, Reference[]>
  reExportedBy?: Map<number, ReExport[]>
  importedBy?: Map<number, ReExport[]>
  refById?: Map<number, Reference>
  declByQName?: Map<string, AnyDecl>
  slugByName?: Map<string, string>
}

/** Attach a hidden field — invisible to JSON, but stable for reads. */
const hide = (obj: object, key: string, value: unknown): void => {
  Object.defineProperty(obj, key, { value, enumerable: false, configurable: true })
}

const idOf = (d: AnyDecl): number => (d as T.Base<any>).id

// ============================================================================
// FORWARD PASS
// One walk that registers every declaration, threads parent/module pointers,
// and tags every encountered `reference` type with its enclosing declaration.
// ============================================================================

const indexModule = (mod: Module, parent: Module | undefined, state: State): void => {
  registerRoutable(mod, state)
  hide(mod, 'project', state.proj)
  if (parent) hide(mod, 'parentModule', parent)
  hide(mod, '$', makeModuleQueries(mod, state))
  for (const child of mod.children) indexChild(child, mod, state)
}

const indexChild = (decl: AnyDecl, mod: Module, state: State): void => {
  if (decl.kind === 'module') return indexModule(decl, mod, state)
  registerRoutable(decl, state)
  hide(decl, '$', makeDeclarationQueries(decl, mod, state))
  walk.Declaration(decl as T.AnyDeclaration, {
    onReference: (ref) => {
      const r = ref as Reference
      state.allReferences.push(r)
      hide(r, '$', { enclosingDeclaration: decl } satisfies ReferenceQueries)
    },
    onReExport: () => {
      // Re-export resolution happens in `resolveReExport` once $.module is set.
    },
  })
}

const registerRoutable = (decl: AnyDecl, state: State): void => {
  state.declarationsById.set(idOf(decl), decl)
  const slug = (decl as { slug?: string }).slug
  const qn = (decl as { qualifiedName?: string }).qualifiedName
  if (slug) {
    state.slugById.set(idOf(decl), slug)
    state.idBySlug.set(slug, idOf(decl))
  }
  if (qn) state.qualifiedNameById.set(idOf(decl), qn)
}

// ============================================================================
// FORWARD EDGE RESOLUTION
// Promotes `targetId` / `ids` to direct object pointers and resolves the
// module specifier on every re-export.
// ============================================================================

const resolveForwardEdges = (state: State): void => {
  for (const ref of state.allReferences) {
    const tid = (ref as Reference & { targetId?: number }).targetId
    if (tid === undefined) continue
    const target = state.declarationsById.get(tid)
    if (target) hide(ref, 'target', target)
  }
  for (const decl of state.declarationsById.values()) {
    if (decl.kind === 're-export') resolveReExport(decl, state)
    else if (decl.kind === 'type-alias') resolveTypeAlias(decl)
  }
}

const resolveReExport = (re: ReExport, state: State): void => {
  const ids = (re as ReExport & { ids?: number[] }).ids ?? []
  const targets = ids.map((id) => state.declarationsById.get(id)).filter((d): d is AnyDecl => !!d)
  hide(re, 'targets', targets)
  const owner = re.$.module
  const ref = modulePath.resolve(modulePath.label(owner), re.sourceModule, state.topModulesByLabel)
  if (ref) hide(re, 'sourceModuleRef', ref)
}

const resolveTypeAlias = (alias: TypeAlias): void => {
  if (alias.type.kind !== 'reference') return
  const target = (alias.type as Reference).target
  if (target) hide(alias, 'target', target)
}

// ============================================================================
// QUERY FACTORIES
// Closures over `state` so reverse lookups can lazily materialize without
// every declaration carrying its own caches.
// ============================================================================

const makeDeclarationQueries = (decl: AnyDecl, mod: Module, state: State): DeclarationQueries => ({
  module: mod,
  referencedBy: () => referencedByMap(state).get(idOf(decl)) ?? [],
  reExportedBy: () => reExportedByMap(state).get(idOf(decl)) ?? [],
})

const makeModuleQueries = (mod: Module, state: State): ModuleQueries => ({
  module: mod,
  referencedBy: () => referencedByMap(state).get(mod.id) ?? [],
  reExportedBy: () => reExportedByMap(state).get(mod.id) ?? [],
  importedBy: () => importedByMap(state).get(mod.id) ?? [],
  declarationByName: (name) => moduleDeclByName(mod, state).get(name),
})

// ============================================================================
// LAZY REVERSE CACHES
// Each map is built once on first call. Subsequent reads are O(1).
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

const reExportedByMap = (state: State): Map<number, ReExport[]> => {
  if (state.reExportedBy) return state.reExportedBy
  const map = new Map<number, ReExport[]>()
  for (const decl of state.declarationsById.values()) {
    if (decl.kind !== 're-export') continue
    for (const target of decl.targets) {
      const id = idOf(target)
      const arr = map.get(id)
      if (arr) arr.push(decl)
      else map.set(id, [decl])
    }
  }
  return (state.reExportedBy = map)
}

const importedByMap = (state: State): Map<number, ReExport[]> => {
  if (state.importedBy) return state.importedBy
  const map = new Map<number, ReExport[]>()
  for (const decl of state.declarationsById.values()) {
    if (decl.kind !== 're-export' || !decl.sourceModuleRef) continue
    const arr = map.get(decl.sourceModuleRef.id)
    if (arr) arr.push(decl)
    else map.set(decl.sourceModuleRef.id, [decl])
  }
  return (state.importedBy = map)
}

/**
 * Per-module name → declaration map. Local children are keyed by their own
 * name; re-exported names by their external alias (the `as` in
 * `export { foo as bar }`, or the target's own name for `export *`).
 */
const moduleDeclByName = (mod: Module, state: State): Map<string, AnyDecl> => {
  const cached = state.declByName.get(mod.id)
  if (cached) return cached
  const map = new Map<string, AnyDecl>()
  for (const child of mod.children) {
    if (child.kind === 're-export') {
      if (child.form === 'named') {
        for (const entry of child.named) {
          const target = child.targets.find((t) => (t as { name?: string }).name === entry.name)
          if (target) map.set(entry.as ?? entry.name, target)
        }
      } else {
        for (const t of child.targets) {
          const n = (t as { name?: string }).name
          if (n) map.set(n, t)
        }
      }
    } else {
      const n = (child as { name?: string }).name
      if (n) map.set(n, child)
    }
  }
  state.declByName.set(mod.id, map)
  return map
}

// ============================================================================
// PROJECT-LEVEL HELPERS
// Same hidden-property convention as declarations so the project object stays
// JSON-clean (Maps/functions wouldn't serialize anyway, but consistency wins).
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
}

const refByIdMap = (state: State): Map<number, Reference> => {
  if (state.refById) return state.refById
  const map = new Map<number, Reference>()
  for (const ref of state.allReferences) map.set(ref.id, ref)
  return (state.refById = map)
}

/**
 * `name` → slug, with bare-name fallback. Bare names resolve to the
 * shallowest matching declaration so that `{@link Foo}` from any context
 * lands on the obvious target.
 */
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

/**
 * `"<topModulePath>:<ns?.>...<name>"` for module-scoped declarations, with a
 * bare-name fallback (shallowest match wins). Mirrors the convention used by
 * the client-side index in `client/src/util/reflection.ts`.
 */
const declByQNameMap = (state: State): Map<string, AnyDecl> => {
  if (state.declByQName) return state.declByQName
  const map = new Map<string, AnyDecl>()
  const bare: { name: string; depth: number; decl: AnyDecl }[] = []
  for (const decl of state.declarationsById.values()) {
    if (decl.kind === 'module') continue
    const name = (decl as { name?: string }).name
    if (!name) continue
    const mod = (decl as { $: DeclarationQueries }).$.module
    const qn = qualify(mod, name)
    map.set(qn, decl)
    bare.push({ name, depth: qn.split(/[:.]/).length, decl })
  }
  bare.sort((a, b) => a.depth - b.depth)
  for (const { name, decl } of bare) if (!map.has(name)) map.set(name, decl)
  return (state.declByQName = map)
}

const qualify = (mod: Module, name: string): string => {
  const parts: string[] = [name]
  let cur: Module = mod
  while (cur.parentModule) {
    if (cur.name) parts.unshift(cur.name)
    cur = cur.parentModule
  }
  const top = cur.path ?? cur.name ?? ''
  return top ? `${top}:${parts.join('.')}` : parts.join('.')
}
