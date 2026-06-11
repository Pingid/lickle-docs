import { For, Show } from 'solid-js'
import cn from '@lickle/cn'

import { A, useLocation } from '../util/router.tsx'

import { createSlot, type Docs } from '../context/index.tsx'
import { DocRouter, useProject } from '../hooks/index.ts'
import * as Type from './Type.tsx'
import type { Route } from '../../core/route/types.ts'

/**
 * Navigation tree built from the router's sidebar: grouped entries with
 * kind badges, collapsible branches, and the branch on the active path open
 * automatically. Replaceable via the `sidebar` slot; `onNavigate` fires on
 * link clicks so a mobile drawer can close itself.
 * @group components
 */
export const Sidebar = createSlot('sidebar', (props) => {
  const router = DocRouter.use()
  return (
    <aside class={`text-[0.8125rem] ${props.class ?? ''}`}>
      <nav class="pt-5 pb-10 px-2.5 space-y-0.5">
        <NavList routes={router()?.sidebar ?? []} depth={0} onNavigate={props.onNavigate} />
      </nav>
    </aside>
  )
})

/** A flat run of sibling routes. */
const NavList = (props: { routes: Docs.GroupedItems<Docs.SidebarRoute>[]; depth: number; onNavigate?: () => void }) => (
  <For each={props.routes}>
    {(route) => <NavChildren route={route} depth={props.depth} onNavigate={props.onNavigate} />}
  </For>
)

/** The grouped children of a route, each group preceded by a {@link GroupLabel}. */
const NavChildren = (props: {
  route: Docs.GroupedItems<Docs.SidebarRoute>
  depth: number
  onNavigate?: () => void
}) => {
  if (props.depth > 10) return <div>Too deep</div>
  return (
    <div style={{ '--sidebar-depth': props.depth }}>
      <Show when={props.route.group}>
        <GroupLabel label={props.route.group} depth={props.depth} />
      </Show>
      <For each={props.route.items}>
        {(child) => <NavNode route={child} depth={props.depth} onNavigate={props.onNavigate} />}
      </For>
    </div>
  )
}

/** A non-interactive section heading shown above a run of related routes. */
const GroupLabel = (props: { label: string; depth: number }) => (
  <div
    class={cn(
      'pr-2 pt-2 pb-1 text-[0.6875rem] font-medium text-mute/55 select-none first:pt-1',
      'pl-[calc(var(--sidebar-depth)*var(--sidebar-indent))]',
    )}
  >
    {props.label}
  </div>
)

type NodeProps = { route: Docs.SidebarRoute; depth: number; onNavigate?: () => void }

/**
 * A single navigation node.
 *
 * - A route with children is a controlled disclosure: a chevron button toggles
 *   the section while the title stays a plain link. The branch on the active
 *   path opens automatically (slugs are hierarchical, so the active page lives
 *   under its prefix). A native `<details>` can't be used here because its
 *   toggle swallows the router's delegated link clicks.
 * - A leaf route is a plain link.
 */
const NavNode = (props: NodeProps) => {
  const loc = useLocation()
  const router = DocRouter.use()

  const base = () => props.route.slug
  const isActive = () => {
    if (props.route.slug === (router()?.base ?? '/') || !props.route.children.length) {
      return loc.pathname === `/${props.route.slug}`
    }
    return loc.pathname.includes(base())
  }

  return (
    <Show
      when={props.route.children.length > 0}
      fallback={
        <div class="pl-[calc(var(--sidebar-depth)*var(--sidebar-indent))]">
          <span class="w-5 shrink-0" />
          <NodeLink
            class={cn('text-mute hover:bg-hover hover:text-fg transition-colors ')}
            route={props.route}
            active={isActive()}
            onNavigate={props.onNavigate}
          />
        </div>
      }
    >
      <details open={isActive()}>
        <summary
          class={cn(
            'flex items-center list-none cursor-pointer [&::-webkit-details-marker]:hidden',
            '[details[open]>summary>*]:text-fg',
            'pl-[calc(var(--sidebar-depth)*var(--sidebar-indent))]',
          )}
        >
          <span class="p-1 rounded-md text-mute hover:bg-hover hover:text-fg transition-colors">
            <Chevron />
          </span>
          <NodeLink
            class={cn('text-mute hover:bg-hover hover:text-fg transition-colors')}
            route={props.route}
            active={isActive()}
            onNavigate={props.onNavigate}
          />
        </summary>
        <div class="pb-2">
          <NavList routes={props.route.children} depth={props.depth + 1} onNavigate={props.onNavigate} />
        </div>
      </details>
    </Show>
  )
}

const NodeLink = (props: { route: DocRouter.Route; active: boolean; onNavigate?: () => void; class?: string }) => (
  <A
    href={props.route.slug}
    class={cn('flex-1 flex items-center gap-2 rounded-md px-1.5 py-1 min-w-0', props.class)}
    classList={{ '!text-fg font-medium': props.active }}
    onClick={() => props.onNavigate?.()}
  >
    <KindCue route={props.route} />
    <span class="font-mono truncate">{props.route.title}</span>
  </A>
)

const KindCue = (props: { route: Route }) => {
  const project = useProject()
  const kind = () => (props.route.kind === 'doc' ? project()?.byId(props.route.decl)?.kind : undefined)
  return <Show when={kind()}>{(k) => <Type.KindBadge kind={k()} class="text-[0.7rem]! w-3.5 shrink-0" />}</Show>
}

const Chevron = (props: { open?: boolean }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 12 12"
    class="shrink-0 text-mute transition-transform [details[open]>summary_&]:rotate-90"
    classList={{ 'rotate-90': props.open }}
    aria-hidden="true"
  >
    <path d="M4 2.5 7.5 6 4 9.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" />
  </svg>
)
