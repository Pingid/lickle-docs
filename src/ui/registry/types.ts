import type { Component, JSX } from 'solid-js'

import type * as docs from '../../core/client.ts'

// ============================================================================
// MEMBER SECTIONS
// One stable shape across all parent kinds (module, class, interface, enum).
// `items` is optional metadata that filter-style overrides can read; the
// renderer ignores it.
// ============================================================================

export interface ChildSection {
  title: string
  /** Declarations the section will render. Optional metadata for filter overrides. */
  items?: docs.Declaration[]
  render: () => JSX.Element
}

export interface MemberSections {
  module?: (decl: docs.Module, defaults: ChildSection[]) => ChildSection[]
  class?: (decl: docs.Class, defaults: ChildSection[]) => ChildSection[]
  interface?: (decl: docs.Interface, defaults: ChildSection[]) => ChildSection[]
  enum?: (decl: docs.Enum, defaults: ChildSection[]) => ChildSection[]
}

// ============================================================================
// PAGE & TAG REGISTRIES
// Keyed by the schema's discriminant so each entry is type-narrowed.
// `TagComponents` also allows arbitrary `@foo` keys for user-defined tags.
// ============================================================================

type Kind = docs.Declaration['kind']

export type PageComponents = {
  [K in Kind]?: Component<{ decl: docs.Declaration<K> }>
}

export type KnownTagKey = keyof docs.CommentTagMap

export type TagComponent<T = docs.CommentTag> = Component<{ tag: T; decl?: docs.Declaration }>

/**
 * Known tags get narrow per-tag types so overrides like `tags['@returns']`
 * type-check end-to-end. The catch-all index uses `any` to side-step
 * function-parameter contravariance — without it, a narrowly-typed
 * `Component<{ tag: '@returns' tag }>` cannot be assigned to a slot that
 * also has to accept a broader CommentTag.
 */
export type TagComponents = {
  [K in KnownTagKey]?: TagComponent<docs.CommentTagMap[K]>
} & {
  [otherTag: string]: Component<any> | undefined
}

// ============================================================================
// SLOTS
// Every slot receives a `Default` prop so the override can call back into the
// stock component and decorate, instead of replacing it wholesale.
// ============================================================================

export interface Slots {
  layout?: Component<{ children: JSX.Element; Default: Component<{ children: JSX.Element }> }>
  header?: Component<{ Default: Component }>
  sidebar?: Component<{ Default: Component }>
  breadcrumb?: Component<{ id: number; Default: Component<{ id: number }> }>
  pageHeader?: Component<{ decl: docs.Declaration; Default: Component<{ decl: docs.Declaration }> }>
  pageFooter?: Component<{ decl: docs.Declaration }>
  references?: Component<{ id: number; Default: Component<{ id: number }> }>
  source?: Component<{ sources?: docs.Source[]; Default: Component<{ sources?: docs.Source[] }> }>
}

// ============================================================================
// ENTRY POINT
// One blob passed via `<ProjectProvider components={...}>`.
// ============================================================================

export interface Components {
  pages?: PageComponents
  tags?: TagComponents
  slots?: Slots
  sections?: MemberSections
}
