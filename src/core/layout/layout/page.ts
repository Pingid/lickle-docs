import type { Layout, LayoutContext, PageSource, Parent, Placement, Rank } from '../types.ts'
import type * as Reflect from '../../reflect/index.ts'
import * as Slug from '../../../_lib/slug/index.ts'
import { defaultLayout } from '../default.ts'
import { createDeclarationFacade } from '../facade.ts'
import * as Match from './match.ts'
import * as Select from './select.ts'
import * as Place from './place.ts'

/**
 * The tree-shaped face of the layout: the config *is* the sidebar.
 *
 * A composed {@link Place} chain describes placement as a sequence of edits;
 * {@link Outline.of} states one level of shape. This module states the whole
 * shape — nested, so the nesting of the definition mirrors the nesting of the
 * generated site:
 *
 * ```ts
 * Page.roots(
 *   Page.nav('Overview', Match.file('README.md')),
 *   Page.nav('API',
 *     Match.file('src/core.ts'),
 *     Page.bucket(Select.tag('@group')),
 *   ),
 *   Page.nav('String',
 *     Match.file('src/string.ts'),
 *     Page.bucket(Select.tag('@group')),
 *     Page.inline,
 *   ),
 * )
 * ```
 *
 * A tree compiles to ordinary layers — one per node, plus {@link Place.within}
 * scopes for the modifiers — so nothing is hidden: `ldocs why` names the node
 * that placed a source, and a `Page.roots` is an ordinary {@link Layout} that
 * composes with layers before and after it.
 *
 * Three words, three sidebar shapes:
 *  - {@link nav} — a **row**: a source (module, markdown page) placed here,
 *    renamed to the label, its members nested beneath it;
 *  - {@link section} — a **heading**: its child rows grouped under a label;
 *  - {@link folder} — a **collapsible folder** with no page of its own.
 *
 * Where two parts match the same source, the **first** to name it owns it —
 * the natural reading of an ordered list, and the rule {@link Outline.of}
 * follows too.
 *
 * The tree is total over the sidebar: a source the tree doesn't reach keeps
 * its page but earns no sidebar row. Page *existence* stays orthogonal —
 * compose `Place.defaultFilter` (or any filter) below to decide what is
 * documented at all.
 */

// ─────────────────────────────────────────────────────────────────────────
// Parts — what a node is made of
// ─────────────────────────────────────────────────────────────────────────

const part = Symbol('Page.part')

/** A page row: the source `identity` matches, renamed `label`, at this position. */
export type NavNode = { [part]: 'nav'; label: string; parts: Part[] }
/** A heading: child rows grouped under `label` within the enclosing node. */
export type SectionNode = { [part]: 'section'; label: string; parts: Part[] }
/** A collapsible virtual folder labelled `label`, with no page of its own. */
export type FolderNode = { [part]: 'folder'; label: string; parts: Part[] }
/** Sources gathered under the enclosing node, keeping their own names and order. */
export type ChildrenPart = { [part]: 'children'; match: Match.Match }
/** A rule over the enclosing node's subtree, compiled against its scope. */
export type ModifierPart = { [part]: 'modifier'; build: (subtree: Match.Match) => Layout }
/** Several parts as one value — {@link compose}. */
export type ComposedPart = { [part]: 'compose'; parts: Part[] }

/**
 * One ingredient of a node. A bare {@link Match.Match} is the node's
 * **identity** — the source that *is* this row; everything else says what
 * happens beneath it.
 */
export type Part = Match.Match | NavNode | SectionNode | FolderNode | ChildrenPart | ModifierPart | ComposedPart

/**
 * A **row**: the source `identity` matches (a bare {@link Match.Match} among
 * `parts`), placed at this position in the tree and renamed to `label`. Its
 * exposed members nest beneath it exactly as the default layout would place
 * them; the other parts refine that subtree:
 *
 *  - nested {@link nav}s / {@link section}s — structure below this row;
 *  - {@link children} — extra sources pulled under it;
 *  - {@link bucket}, {@link inline}, {@link order}, {@link depth},
 *    {@link layer} — rules over everything beneath it.
 *
 * Naming a source as a row asserts it belongs in the site, so the identity is
 * revived if a filter or the export graph dropped it. The identity names
 * **one** source: where it matches several declarations — `Match.file` on a
 * module also matches everything declared in that file — the row is the
 * container (an entrypoint, else a module or namespace, else the first match),
 * and the rest are simply reached by the tree.
 *
 * @example A module as a top-level row, members grouped by tag
 * ```ts
 * Page.nav('API', Match.file('src/core.ts'), Page.bucket(Select.tag('@group')))
 * ```
 */
export const nav = (label: string, ...parts: Part[]): NavNode => ({ [part]: 'nav', label, parts: flatten(parts) })

/**
 * A **heading**: its child rows and {@link children} appear under `label`
 * within the enclosing node, in list order. Purely presentational — a heading
 * groups the level it sits on, it does not nest URLs (that is {@link nav} and
 * {@link folder}).
 *
 * A {@link folder} inside a section escapes the heading — folder rows cannot
 * carry a group — so prefer sections of rows.
 *
 * @example
 * ```ts
 * Page.section('Guides', Page.children(Match.file('docs/guides/*.md')))
 * ```
 */
export const section = (label: string, ...parts: Part[]): SectionNode => ({
  [part]: 'section',
  label,
  parts: flatten(parts),
})

/**
 * A **collapsible folder** with no page of its own: a virtual sidebar node
 * holding its children. Nests under enclosing folders; not expressible inside a
 * {@link nav} (a declaration cannot parent a virtual folder — nest rows, or use
 * a {@link section} heading, instead).
 *
 * @example
 * ```ts
 * Page.folder('Guides', Page.children(Match.file('docs/guides/*.md')))
 * ```
 */
export const folder = (label: string, ...parts: Part[]): FolderNode => ({
  [part]: 'folder',
  label,
  parts: flatten(parts),
})

/**
 * Sources gathered under the enclosing node, keeping their **own** names,
 * order and buckets — the plural counterpart to a {@link nav}'s singular
 * identity. Use it when a set belongs here: the guides under a folder, a
 * tagged family of helpers under their host module.
 *
 * @example The 55 primitives, hosted on their module's page
 * ```ts
 * Page.nav('primitives',
 *   Match.file('src/ui/primitives/index.ts'),
 *   Page.children(Match.tag('@group', 'primitives')),
 *   Page.inline,
 * )
 * ```
 */
export const children = (match: Match.Match): ChildrenPart => ({ [part]: 'children', match })

/**
 * Several parts as one value, for building a node's ingredients up separately:
 * `Page.nav('API', Page.compose(identity, mods))` and
 * `Page.nav('API', identity, mods)` are the same node.
 */
export const compose = (...parts: Part[]): ComposedPart => ({ [part]: 'compose', parts: flatten(parts) })

// ─────────────────────────────────────────────────────────────────────────
// Modifiers — rules over a node's subtree
// ─────────────────────────────────────────────────────────────────────────

const modifier = (build: (subtree: Match.Match) => Layout): ModifierPart => ({ [part]: 'modifier', build })

/**
 * Group the node's members under headings — {@link Place.bucket}, scoped to
 * this node's subtree. Same two forms: derive each member's bucket from a
 * {@link Select}, or put matching members in a fixed one.
 *
 * @example
 * ```ts
 * Page.bucket(Select.tag('@group'))
 * Page.bucket(Match.kinds('interface', 'type-alias'), 'types')
 * ```
 */
export const bucket: {
  (select: Select.Select<string | undefined>): ModifierPart
  (match: Match.Match, name: Select.Value<string>): ModifierPart
} = (arg: any, name?: any): ModifierPart =>
  modifier((subtree) =>
    Place.within(subtree, name === undefined ? Place.bucket(arg) : Place.bucket(arg, name)),
  )

/**
 * Render the node's members **inline** on its page: full docs on one screen,
 * no routes or sidebar rows of their own. The node itself keeps its page —
 * that is what the members render on.
 */
export const inline: ModifierPart = modifier((subtree) =>
  Place.within(subtree, Place.visibility(Match.all(), { render: 'inline' })),
)

/**
 * Pin the order of the node's members — {@link Place.order}, scoped to this
 * node's subtree. Unmatched members stay alphabetical after the pinned ones.
 */
export const order = (...items: (string | RegExp | Match.Match)[]): ModifierPart =>
  modifier((subtree) => Place.within(subtree, Place.order(...items)))

/**
 * How far the sidebar expands below this node — {@link Place.depth}, scoped to
 * its subtree. `beyond` says what happens past the cut (default `'nav'`).
 */
export const depth = (max: number, beyond?: 'nav' | 'inline' | 'hidden'): ModifierPart =>
  modifier((subtree) => Place.within(subtree, Place.depth(max, beyond ? { beyond } : undefined)))

/**
 * The escape hatch: raw {@link Place} layers, scoped to this node's subtree.
 * Anything the parts above don't say is still an ordinary layer, and still
 * confined to this branch of the tree.
 *
 * @example Flat labels under one node
 * ```ts
 * Page.nav('ui', Match.entry('ui'), Page.layer(Place.qualify(Match.all(), false)))
 * ```
 */
export const layer = (...layouts: Layout[]): ModifierPart => modifier((subtree) => Place.within(subtree, ...layouts))

// ─────────────────────────────────────────────────────────────────────────
// The compiler
// ─────────────────────────────────────────────────────────────────────────

/**
 * Compile the tree into a {@link Layout}. List order is display order at every
 * level — the definition reads as the sidebar it produces.
 *
 * The tree is **total over the sidebar**: what it doesn't reach — not a row,
 * not gathered by {@link children}, not exposed beneath a row — keeps its page
 * and loses its sidebar row. So the sidebar shows exactly the structure
 * written here, while `{@link}` references and member listings keep resolving.
 * Modifiers passed directly to `roots` apply to every source.
 */
export const roots = (...parts: Part[]): Layout => {
  const registry: ClaimEntry[] = []
  const scope: Scope = { at: { root: true }, claim: claimsOf(registry), registry }
  const { layers, reach } = compileScope(flatten(parts), scope)

  // Everything the tree reaches, directly or through exposure beneath a row.
  const direct = Match.any(...reach)
  const claimed = Match.any(direct, Match.under(direct))
  // An explicit page aspect, so standalone pages are held to the same totality
  // even when no part of the tree mentions pages.
  const rest = Match.match(
    (d, place) => !claimed(d, place),
    (p, place) => !(claimed.page?.(p, place) ?? false),
  )

  return Place.label(
    'Page.roots',
    Place.compose(...layers, Place.label('Page.rest', Place.visibility(rest, { nav: false }))),
    { transparent: true },
  )
}

/** Where a scope's rows attach, and the heading they sit under, if any. */
type Scope = {
  at: { root: true } | { virtual: string; label: string; order?: Rank } | { into: Host }
  group?: { name: string; order: number }
  /** The whole tree's claim table — see {@link claimsOf}. */
  claim: ClaimFn
  registry: ClaimEntry[]
}

/** The enclosing row, as a scope sees it: its match for scoping, its resolver for parenting. */
type Host = { match: Match.Match; resolve: Resolver; missing: string }

type Compiled = { layers: Layout[]; reach: Match.Match[] }

/** One placing part's claim: its match, narrowed to the owned declaration for row identities. */
type ClaimEntry = { match: Match.Match; own?: Resolver }

/** Which part owns a source: its index in the registry, or `-1` for none. */
type ClaimFn = (source: PageSource, place: Placement, cx: LayoutContext) => number

/**
 * The claim table: parts register in tree order, and a source belongs to the
 * **first** part whose match accepts it — the natural reading of an ordered
 * list, and the rule that keeps two overlapping matches from fighting over one
 * source (`Outline.of` claims the same way). Memoized per source, so the
 * placement a part makes and the scopes that read it back cannot disagree.
 */
const claimsOf = (registry: ClaimEntry[]): ClaimFn => {
  const cache = new Map<unknown, number>()
  return (source, place, cx) => {
    const key = source.kind === 'doc' ? source.decl.id : source
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const at = registry.findIndex(({ match, own }) =>
      source.kind === 'doc'
        ? match(source.decl, place) && ownedBy(own, source.decl.id, cx)
        : (match.page?.(source, place) ?? false),
    )
    cache.set(key, at)
    return at
  }
}

const flatten = (parts: Part[]): Part[] =>
  parts.flatMap((p) => (!Match.is(p) && p[part] === 'compose' ? (p as ComposedPart).parts : [p]))

const isNode = (p: Part): p is NavNode | SectionNode | FolderNode =>
  !Match.is(p) && (p[part] === 'nav' || p[part] === 'section' || p[part] === 'folder')

/**
 * Compile one level. Each placing part — row, section, folder, children —
 * takes the next slot in the running order; modifiers take none and apply to
 * everything the level reaches.
 */
const compileScope = (parts: Part[], scope: Scope): Compiled => {
  const layers: Layout[] = []
  const reach: Match.Match[] = []
  const modifiers: ModifierPart[] = []
  let slot = 0

  for (const p of parts) {
    if (Match.is(p)) {
      // A bare Match outside a nav gathers, like `children` — the common case
      // reads without the wrapper.
      slot++
      compileChildren(p, scope, layers, reach)
    } else if (p[part] === 'children') {
      slot++
      compileChildren(p.match, scope, layers, reach)
    } else if (p[part] === 'modifier') {
      modifiers.push(p)
    } else if (isNode(p)) {
      compileNode(p, scope, slot++, layers, reach)
    }
  }

  // Modifiers close over the level's subtree: at the bare root that is every
  // source; inside a page row, the row's members but never the row itself —
  // `Page.inline` collapses what's *on* the page, not the page. They compose
  // BELOW the level's nodes, so a broad rule never overrides the structure
  // written out explicitly beside it.
  const subtree =
    'root' in scope.at && scope.group === undefined
      ? Match.all()
      : 'into' in scope.at
        ? Match.any(...reach, Match.under(Match.any(scope.at.into.match, ...reach)))
        : subtreeOf(reach)
  return { layers: [...modifiers.map((m) => m.build(subtree)), ...layers], reach }
}

/** A level's subtree: what it reaches, plus everything exposed beneath that. */
const subtreeOf = (reach: Match.Match[]): Match.Match => {
  const direct = Match.any(...reach)
  return Match.any(direct, Match.under(direct))
}

/** Gather matching sources under the scope, keeping their own names and order. */
const compileChildren = (match: Match.Match, scope: Scope, layers: Layout[], reach: Match.Match[]) => {
  reach.push(match)
  const at = scope.registry.push({ match }) - 1
  const parent = parentOf(scope)
  layers.push(
    attach(`Page.children`, {
      claim: { at, of: scope.claim },
      ...(parent === undefined ? {} : { parent }),
      ...('into' in scope.at ? { into: scope.at.into } : {}),
      ...(scope.group ? { group: scope.group } : {}),
    }),
  )
}

const compileNode = (
  node: NavNode | SectionNode | FolderNode,
  scope: Scope,
  slot: number,
  layers: Layout[],
  reach: Match.Match[],
) => {
  if (node[part] === 'section') {
    const inner = compileScope(node.parts, { ...scope, group: { name: node.label, order: slot } })
    layers.push(...inner.layers)
    reach.push(...inner.reach)
    return
  }

  if (node[part] === 'folder') {
    if ('into' in scope.at)
      throw new Error(
        `Page.folder('${node.label}') cannot sit inside a page row — a declaration cannot parent a virtual folder. Nest Page.nav rows, or group with Page.section.`,
      )
    const base = 'virtual' in scope.at ? `${scope.at.virtual}/` : ''
    // The folder's own position; children keep the order they earned inside it.
    const inner = compileScope(node.parts, {
      ...scope,
      at: { virtual: `${base}${Slug.toSlug(node.label)}`, label: node.label, order: [CONTENT_BAND, slot] },
      group: undefined,
    })
    layers.push(...inner.layers)
    reach.push(...inner.reach)
    return
  }

  // A row. Its identity is the bare Match(es) among its parts.
  const identities = node.parts.filter(Match.is)
  if (identities.length === 0)
    throw new Error(
      `Page.nav('${node.label}') has no identity — give it a Match (the source that IS this row), or use Page.section / Page.folder for a label-only group.`,
    )
  const identity = identities.length === 1 ? identities[0]! : Match.any(...identities)
  const rest = node.parts.filter((p) => !Match.is(p))
  const host: Host = {
    match: identity,
    resolve: resolverOf(identity),
    missing: `Page.nav(${node.label}) resolves to no declaration; sources under it stay where they were.`,
  }

  reach.push(identity)
  // The claim carries the resolver: `Match.file` on a module also matches
  // everything declared in that file, and the row is the module.
  const at = scope.registry.push({ match: identity, own: host.resolve }) - 1
  const parent = parentOf(scope)
  layers.push(
    attach(`Page.nav(${node.label})`, {
      claim: { at, of: scope.claim },
      // Naming it asserts it belongs: revive it if a filter or the export
      // graph flattened it away.
      revive: true,
      ...(parent === undefined ? {} : { parent }),
      ...('into' in scope.at ? { into: scope.at.into } : {}),
      name: node.label,
      // An explicitly placed row sits in its heading, or the unheaded run —
      // never in a bucket some broader layer assigned.
      group: scope.group ?? { name: '', order: slot },
      order: [CONTENT_BAND, slot],
    }),
  )

  const inner = compileScope(rest, { ...scope, at: { into: host }, group: undefined })
  layers.push(...inner.layers)
  reach.push(...inner.reach)
}

/** The parent a scope's rows attach to; `undefined` inside a page row, where the host resolver sets it. */
const parentOf = (scope: Scope): Parent | undefined => {
  if ('root' in scope.at) return { root: true }
  if ('virtual' in scope.at) {
    const { virtual, label, order } = scope.at
    return { virtual, label, ...(order === undefined ? {} : { order }) }
  }
  return undefined
}

/**
 * Band 0 of the {@link Rank} space: content the config positioned, leading the
 * entrypoint modules the scan discovered (band 1).
 */
const CONTENT_BAND = 0

/** Resolve a match to the one declaration it names, once per index. */
type Resolver = (cx: LayoutContext, warn?: string) => Reflect.Id | null

/**
 * The declaration a match **names**: scan the index, preferring an entrypoint,
 * then a module or namespace, then the first match. The preference is what
 * makes `Match.file('src/string.ts')` usable as a row identity — it matches the
 * module *and* everything declared in the file, and the row is the module.
 *
 * `null` when nothing matches — normal for a markdown identity, reported (as
 * `missing-parent`, once) when a caller passes `warn` because children needed it.
 */
const resolverOf = (match: Match.Match): Resolver => {
  const cache = new WeakMap<object, Reflect.Id | null>()
  const warned = new WeakSet<object>()
  return (cx, warn) => {
    const key = cx.index as object
    let found = cache.get(key)
    if (found === undefined) {
      let best: { id: Reflect.Id; score: number } | null = null
      for (const decl of cx.index.declarations()) {
        const facade = createDeclarationFacade(cx.index, decl.id)
        if (!facade || !match(facade)) continue
        const score = facade.isEntry() ? 0 : facade.kind === 'module' || facade.kind === 'namespace' ? 1 : 2
        if (best === null || score < best.score) best = { id: decl.id, score }
        if (score === 0) break
      }
      found = best?.id ?? null
      cache.set(key, found)
    }
    if (found === null && warn !== undefined && !warned.has(key)) {
      warned.add(key)
      cx.emit?.({ level: 'warn', code: 'missing-parent', message: warn })
    }
    return found
  }
}

/**
 * The one primitive under every node: move matching placed sources here.
 * Sets what the spec names, drops the derived nav so the sidebar row moves
 * with the page — the same reason {@link Place.folder} and {@link Place.into}
 * do — and leaves everything else (slug, render, unspecified fields) as the
 * layers below decided.
 */
const attach = (
  label: string,
  spec: {
    /** This part's place in the claim table: it acts only on sources it owns. */
    claim: { at: number; of: ClaimFn }
    /** Bring an excluded hit back — naming a row asserts it belongs. */
    revive?: boolean
    parent?: Parent
    /** Parent under the enclosing row, resolved against the index. */
    into?: Host
    name?: string
    group?: { name: string; order: number }
    order?: Rank
  },
): Layout =>
  Place.label(label, (source, cx) => {
    let base = cx.default()
    if (spec.claim.of(source, base, cx) !== spec.claim.at) return base
    if (base.page === null) {
      if (!spec.revive || source.kind !== 'doc') return base
      base = defaultLayout(source, { docs: cx.index, name: cx.name })
    }

    let parent = spec.parent
    if (spec.into !== undefined) {
      const id = spec.into.resolve(cx, spec.into.missing)
      if (id === null) return base
      // The row resolving to its own host would parent it under itself.
      parent = source.kind === 'doc' && source.decl.id === id ? undefined : { decl: id }
    }

    const { nav: _derive, ...kept } = base
    return {
      ...kept,
      page: {
        ...base.page!,
        ...(parent === undefined ? {} : { parent }),
        ...(spec.name === undefined ? {} : { name: spec.name }),
        ...(spec.group === undefined ? {} : { group: spec.group }),
        ...(spec.order === undefined ? {} : { order: spec.order }),
      },
    } satisfies Placement
  })

/** Whether a doc hit is the declaration the identity names; an unresolvable identity keeps the raw match. */
const ownedBy = (own: Resolver | undefined, id: Reflect.Id, cx: LayoutContext): boolean => {
  if (own === undefined) return true
  const chosen = own(cx)
  return chosen === null || chosen === id
}
