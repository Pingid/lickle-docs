import type { Component, JSX } from 'solid-js'

import type * as docs from '../../core/client.ts'

// ============================================================================
// MEMBER SECTIONS
// One stable shape across all parent kinds (module, class, interface, enum).
// `items` is optional metadata that filter-style overrides can read; the
// renderer ignores it.
// ============================================================================

/**
 * One renderable group inside a page's member list.
 *
 * `items` is the input list — filter-style overrides reduce/sort/extend it,
 * then `render(items)` paints the final view. Sections whose content isn't
 * a list of declarations (e.g. a single index signature) still pass `items`,
 * just empty.
 */
export interface ChildSection {
  title: string
  items: docs.Declaration[]
  render: (items: docs.Declaration[]) => JSX.Element
}

export interface MemberSections {
  module?: (decl: docs.Module, defaults: ChildSection[]) => ChildSection[]
  class?: (decl: docs.Class, defaults: ChildSection[]) => ChildSection[]
  interface?: (decl: docs.Interface, defaults: ChildSection[]) => ChildSection[]
  enum?: (decl: docs.Enum, defaults: ChildSection[]) => ChildSection[]
}

// ============================================================================
// PAGE & TAG REGISTRIES
// Storage types are uniformly broad so the runtime dispatcher never casts.
// Authors get narrow per-key types through the `page()` / `tag()` helpers
// in `registry/authoring.ts` — that's where contravariance gets pinned.
// ============================================================================

export type KnownTagKey = keyof docs.CommentTagMap

export type PageComponent = Component<{ decl: docs.Declaration }>
export type PageComponents = Partial<Record<docs.Declaration['kind'], PageComponent>>

export type TagComponent<T = docs.CommentTag> = Component<{ tag: T; decl?: docs.Declaration }>
export type TagComponents = { [K in keyof docs.CommentTagMap]?: TagComponent<docs.CommentTagMap[K]> } & {
  [key: string]: TagComponent
}

// ============================================================================
// SLOTS
// Every slot receives a `Default` prop so the override can call back into the
// stock component and decorate, instead of replacing it wholesale.
// ============================================================================

export type HeaderProps = { onMenu?: () => void; onSearch?: () => void }
export type SidebarProps = { onNavigate?: () => void; class?: string }
export type LayoutProps = { children: JSX.Element }
export type BreadcrumbProps = { id: number }
export type PageHeaderProps = { decl: docs.Declaration }
export type ReferencesProps = { id: number }
export type SourceProps = { sources?: docs.Source[] }

type WithDefault<P extends Record<string, any>> = P & { Default: Component<P> }

/**
 * Slot override signatures. Every slot receives `Default` typed to the
 * stock component's props so the override can decorate (`<Default {...p} />`
 * plus extras) instead of replacing wholesale.
 */
export interface Slots {
  layout?: Component<WithDefault<LayoutProps>>
  header?: Component<WithDefault<HeaderProps>>
  sidebar?: Component<WithDefault<SidebarProps>>
  breadcrumb?: Component<WithDefault<BreadcrumbProps>>
  pageHeader?: Component<WithDefault<PageHeaderProps>>
  pageFooter?: Component<{ decl: docs.Declaration }>
  references?: Component<WithDefault<ReferencesProps>>
  source?: Component<WithDefault<SourceProps>>
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
