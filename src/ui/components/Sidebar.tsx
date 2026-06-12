import { createEffect, createSignal, on, For, Show } from 'solid-js'
import cn from '@lickle/cn'

import { A, useLocation } from '../util/router.tsx'

import { createSlot, type Reflect } from '../context/index.tsx'
import { DocRouter, useProject } from '../hooks/index.ts'
import * as Type from './Type.tsx'
import type { Route } from '../../core/route/types.ts'

/**
 * The unique node occurrence the user is viewing, identified by its trail (the
 * chain of slugs from the root). The same page can appear under several parents;
 * the trail disambiguates which occurrence is active so only that branch opens.
 * Shared across sidebar instances (e.g. desktop + mobile drawer) so they agree.
 */
const [selected, setSelected] = createSignal<{ trail: string; path: string } | null>(null)

/** Trail of a child appended to its parent's trail. */
const trailOf = (parent: string, slug: string) => `${parent}>${slug}`

/** Trail of the first node in DFS order whose slug resolves to `pathname`, if any. */
const findTrail = (routes: Reflect.GroupedItems<Reflect.SidebarRoute>[], pathname: string, parent = ''): string | null => {
  for (const group of routes)
    for (const route of group.items) {
      const trail = trailOf(parent, route.slug)
      if (pathOf(route.slug) === pathname) return trail
      const child = findTrail(route.children, pathname, trail)
      if (child) return child
    }
  return null
}

/**
 * Navigation tree built from the router's sidebar: grouped entries with
 * kind badges, collapsible branches, and the branch on the active path open
 * automatically. Replaceable via the `sidebar` slot; `onNavigate` fires on
 * link clicks so a mobile drawer can close itself.
 * @group components
 */
export const Sidebar = createSlot('sidebar', (props) => {
  const router = DocRouter.use()
  const loc = useLocation()

  // Resolve the active occurrence from the URL when it isn't already pinned by a
  // click. A missing match keeps the previous selection so navigating to a page
  // outside the sidebar doesn't collapse the open branch.
  createEffect(() => {
    const path = loc.pathname
    if (selected()?.path === path) return
    const trail = findTrail(router()?.sidebar ?? [], path)
    if (trail) setSelected({ trail, path })
  })

  return (
    <aside class={`text-[0.8125rem] ${props.class ?? ''}`}>
      <nav class="pt-5 pb-10 px-2.5 space-y-0.5">
        <NavList routes={router()?.sidebar ?? []} depth={0} trail="" onNavigate={props.onNavigate} />
      </nav>
    </aside>
  )
})

/** A flat run of sibling routes. */
const NavList = (props: {
  routes: Reflect.GroupedItems<Reflect.SidebarRoute>[]
  depth: number
  trail: string
  onNavigate?: () => void
}) => (
  <For each={props.routes}>
    {(route) => <NavChildren route={route} depth={props.depth} trail={props.trail} onNavigate={props.onNavigate} />}
  </For>
)

/** The grouped children of a route, each group preceded by a {@link GroupLabel}. */
const NavChildren = (props: {
  route: Reflect.GroupedItems<Reflect.SidebarRoute>
  depth: number
  trail: string
  onNavigate?: () => void
}) => {
  if (props.depth > 10) return <div>Too deep</div>
  return (
    <div style={{ '--sidebar-depth': props.depth }}>
      <Show when={props.route.group}>
        <GroupLabel label={props.route.group} depth={props.depth} />
      </Show>
      <For each={props.route.items}>
        {(child) => <NavNode route={child} depth={props.depth} trail={props.trail} onNavigate={props.onNavigate} />}
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

type NodeProps = { route: Reflect.SidebarRoute; depth: number; trail: string; onNavigate?: () => void }

/** Normalised app-absolute path of a route slug, for comparison with `location.pathname`. */
const pathOf = (slug: string) => `/${slug}`.replace(/\/+/g, '/')

/**
 * A single navigation node.
 *
 * - A route with children is a controlled disclosure: a chevron button toggles
 *   the section while the title stays a plain link. Only the branch on the
 *   {@link selected} trail opens — the same route may appear under several
 *   parents, so opening every occurrence would expand unrelated sections; the
 *   trail pins the one the user actually navigated through. A native `<details>`
 *   can't be used because its toggle swallows the router's delegated link clicks.
 * - A leaf route is a plain link.
 */
const NavNode = (props: NodeProps) => {
  const trail = () => trailOf(props.trail, props.route.slug)

  // Exactly this occurrence is highlighted; a branch is "on trail" when the
  // selection is itself or a descendant.
  const isActive = () => selected()?.trail === trail()
  const onTrail = () => {
    const cur = selected()?.trail
    return cur === trail() || !!cur?.startsWith(`${trail()}>`)
  }

  // `open` is a real signal so it can't drift from the DOM: every navigation
  // (selection change) re-syncs it to the active trail — opening the active
  // branch and collapsing the rest — while `onToggle` keeps it honest when the
  // user expands a section manually with the chevron between navigations.
  const [open, setOpen] = createSignal(false)
  createEffect(on(selected, () => setOpen(onTrail())))

  // Pin this occurrence eagerly on click so it wins over the URL-derived fallback.
  const pin = () => {
    setSelected({ trail: trail(), path: pathOf(props.route.slug) })
    props.onNavigate?.()
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
            onNavigate={pin}
          />
        </div>
      }
    >
      <details open={open()} onToggle={(e) => setOpen(e.currentTarget.open)}>
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
            onNavigate={pin}
          />
        </summary>
        <div class="pb-2">
          <NavList routes={props.route.children} depth={props.depth + 1} trail={trail()} onNavigate={props.onNavigate} />
        </div>
      </details>
    </Show>
  )
}

const NodeLink = (props: { route: Reflect.SidebarRoute; active: boolean; onNavigate?: () => void; class?: string }) => (
  <A
    href={props.route.slug}
    class={cn('flex-1 flex items-center gap-2 rounded-md px-1.5 py-1 min-w-0', props.class)}
    classList={{ '!text-fg font-medium': props.active }}
    onClick={() => props.onNavigate?.()}
  >
    <KindCue route={props.route} />
    <span class="font-mono truncate">{props.route.alias ?? props.route.title}</span>
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
