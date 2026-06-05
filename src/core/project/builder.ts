import type * as reflect from '../reflect/index.ts'
import type { ChildSpec, RouteContext } from './routing.ts'
import { pluralLabel, groupOrder } from './kind.ts'

// ----------------------------------------------------------------------------
// Read-only facade over `reflect.Index`
// ----------------------------------------------------------------------------
//
// These wrappers give a custom route layout a small, stable surface to branch
// on (`d.kind`, `d.name`, `d.comment`, `d.exposes()`) without poking raw
// `{ id, alias }` tuples or the index directly. They carry no behaviour of
// their own beyond walking the graph.

export class Decl<K extends keyof reflect.DeclarationMap = keyof reflect.DeclarationMap> {
  protected decl: reflect.Declaration<K>
  protected index: reflect.Index

  constructor(decl: reflect.Declaration<K>, index: reflect.Index) {
    this.decl = decl
    this.index = index
  }

  get id(): number {
    return this.decl.id
  }

  get kind(): K {
    return this.decl.kind
  }

  get name(): string {
    return this.decl.name
  }

  get exported(): boolean {
    return this.decl.exported
  }

  get comment(): reflect.Comment | undefined {
    return this.decl.comment
  }

  /** Ids of declarations that reference this one (its "used in" set). */
  referencedIn(): number[] {
    return [...this.index.referencedIn(this.decl.id)]
  }

  /** Public members exposed (one level) by this declaration, in exposure order. */
  *exposes(): Iterable<Exposed> {
    for (const e of this.index.exposed(this.decl.id)) {
      const d = this.index.get(e.id)
      if (d) yield new Exposed(d, this.index, e.alias)
    }
  }

  /** Raw declaration children (for `full`-mode parity), excluding `export` clauses. */
  *children(): Iterable<Decl> {
    for (const c of this.index.children(this.decl.id)) {
      if (c.kind !== 'export') yield new Decl(c, this.index)
    }
  }
}

export class Exposed<K extends keyof reflect.DeclarationMap = keyof reflect.DeclarationMap> extends Decl<K> {
  private _alias?: string

  constructor(decl: reflect.Declaration<K>, index: reflect.Index, alias?: string) {
    super(decl, index)
    this._alias = alias
  }

  /** Exposure alias on this path (set by renames / `export * as`). */
  get alias(): string | undefined {
    return this._alias
  }

  module(): reflect.Declaration<'module'> | undefined {
    const decl = this.decl as reflect.Declaration
    if (decl.kind === 'module') return decl
    const parent = this.index.get(decl.parent)
    if (parent && parent.kind === 'module') return parent
    return undefined
  }
}

export class EntryPoint extends Decl<'module'> {
  get path(): string {
    return this.decl.path
  }

  /** Entry alias (`as`), defaulting to `.` for the main entry. */
  get alias(): string {
    return this.index.rootAlias(this.decl.id)?.as ?? '.'
  }
}

// ----------------------------------------------------------------------------
// reshape() — ergonomic authoring for `RouteProvider.children`
// ----------------------------------------------------------------------------
//
// The engine speaks raw `ChildSpec[]`; humans shouldn't. `reshape` wraps the
// incoming children as `Exposed`, hands them to a callback alongside a couple
// of helpers, and lowers the result back to `ChildSpec[]`.

/** A node a reshape callback may emit: a wrapped declaration or a synthetic group. */
export type Built = Exposed | GroupNode
export type GroupNode = { group: string; children: Built[] }

export interface ReshapeTools {
  /** The route's children, as wrapped declarations, in their default order. */
  all: Exposed[]
  /** Wrap a run of children under a synthetic sidebar heading. */
  group(label: string, children: Built[]): GroupNode
  /** Comparator: alphabetical by name. */
  byName(a: Decl, b: Decl): number
  /** Comparator: canonical kind order, then name. */
  byKind(a: Decl, b: Decl): number
}

/** Comparator — alphabetical by declaration name. */
export const compareByName = (a: Decl, b: Decl): number => a.name.localeCompare(b.name)

/** Comparator — canonical section order (functions → variables → types → …), then name. */
export const compareByKind = (a: Decl, b: Decl): number =>
  groupOrder(pluralLabel(a.kind)) - groupOrder(pluralLabel(b.kind)) || compareByName(a, b)

/**
 * Reshape a route's children with a callback over wrapped declarations.
 *
 * @example
 * ```ts
 * children: (cx, kids) =>
 *   reshape(cx, kids, ({ all, group, byName }) => {
 *     const types = all.filter((d) => d.kind === 'type-alias' || d.kind === 'interface')
 *     const rest = all.filter((d) => !types.includes(d))
 *     return [...rest.sort(byName), group('Types', types.sort(byName))]
 *   })
 * ```
 */
export const reshape = (cx: RouteContext, kids: ChildSpec[], fn: (tools: ReshapeTools) => Built[]): ChildSpec[] => {
  const all: Exposed[] = []
  for (const k of kids) {
    if ('group' in k) continue // synthetic groups aren't part of the default input
    const d = cx.index.get(k.id)
    if (d) all.push(new Exposed(d, cx.index, k.alias))
  }
  const tools: ReshapeTools = {
    all,
    group: (label, children) => ({ group: label, children }),
    byName: compareByName,
    byKind: compareByKind,
  }
  return lower(fn(tools))
}

const lower = (built: Built[]): ChildSpec[] =>
  built.map((b) =>
    b instanceof Exposed
      ? { id: b.id, ...(b.alias !== undefined ? { alias: b.alias } : {}) }
      : { group: b.group, children: lower(b.children) },
  )

/**
 * Default child layout: group a route's children by declaration kind under
 * synthetic headings, using the same section titles ({@link pluralLabel}) and
 * order ({@link groupOrder}) as the page content listing, names sorted within.
 */
export const kindLayout = (cx: RouteContext, kids: ChildSpec[]): ChildSpec[] =>
  reshape(cx, kids, ({ all, group, byName }) => {
    const buckets = new Map<string, Exposed[]>()
    for (const d of all) {
      const title = pluralLabel(d.kind)
      const arr = buckets.get(title)
      if (arr) arr.push(d)
      else buckets.set(title, [d])
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => groupOrder(a) - groupOrder(b) || a.localeCompare(b))
      .map(([title, items]) => group(title, [...items].sort(byName)))
  })
