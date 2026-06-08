import { For, Show, createEffect, createMemo, createSignal } from 'solid-js'
import { A, useLocation } from '../context/router.tsx'

import { createSlot, useProject, type Types } from '../context/index.tsx'
import { Type } from './Type.tsx'

type Route = Types.Route

export const Sidebar = createSlot('sidebar', (props: { onNavigate?: () => void; class?: string }) => {
  const project = useProject()
  const roots = createMemo(() => project().routes.sidebar)
  // console.log('roots', roots())
  return (
    <aside class={`text-[0.8125rem] ${props.class ?? ''}`}>
      <nav class="pt-5 pb-10 px-2.5 space-y-0.5">
        <NavList routes={roots()} depth={0} onNavigate={props.onNavigate} />
      </nav>
    </aside>
  )
})

/** A flat run of sibling routes. */
const NavList = (props: {
  routes: Types.GroupedItems<Types.SidebarRoute>[]
  depth: number
  onNavigate?: () => void
}) => (
  <For each={props.routes}>
    {(route) => <NavChildren route={route} depth={props.depth} onNavigate={props.onNavigate} />}
  </For>
)

/** The grouped children of a route, each group preceded by a {@link GroupLabel}. */
const NavChildren = (props: {
  route: Types.GroupedItems<Types.SidebarRoute>
  depth: number
  onNavigate?: () => void
}) => {
  if (props.depth > 10) return <div>Too deep</div>
  return (
    <>
      <Show when={props.route.group}>
        <GroupLabel label={props.route.group} depth={props.depth} />
      </Show>
      <For each={props.route.items}>
        {(child) => <NavNode route={child} depth={props.depth} onNavigate={props.onNavigate} />}
      </For>
    </>
  )
}

/** A non-interactive section heading shown above a run of related routes. */
const GroupLabel = (props: { label: string; depth: number }) => (
  <div
    class="pr-2 pt-2 pb-1 text-[0.6875rem] font-medium text-mute/55 select-none first:pt-1"
    style={{ 'padding-left': `calc(${indent(props.depth)} + 1.625rem)` }}
  >
    {props.label}
  </div>
)

type NodeProps = { route: Types.SidebarRoute; depth: number; onNavigate?: () => void }

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
  // const project = useProject()
  const loc = useLocation()

  const base = () => props.route.slug
  const isActive = () => loc.pathname === base()
  const onPath = () => isActive() || loc.pathname.startsWith(`${base()}/`)

  const [open, setOpen] = createSignal(onPath())
  // Auto-open the branch containing the active page; a manual collapse sticks
  // until the route changes.
  createEffect(() => onPath() && setOpen(true))

  return (
    <Show
      when={props.route.children.length > 0}
      fallback={
        <div class="flex items-center" style={{ 'padding-left': indent(props.depth) }}>
          <span class="w-5 shrink-0" />
          <NodeLink route={props.route} active={isActive()} onNavigate={props.onNavigate} />
        </div>
      }
    >
      <div>
        <div class="flex items-center" style={{ 'padding-left': indent(props.depth) }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open()}
            aria-label={open() ? 'Collapse section' : 'Expand section'}
            class="p-1 rounded-md text-mute hover:bg-hover hover:text-fg transition-colors cursor-pointer"
          >
            <Chevron open={open()} />
          </button>
          <NodeLink route={props.route} active={isActive()} onNavigate={props.onNavigate} />
        </div>
        <Show when={open()}>
          <div class="pb-2">
            <NavList routes={props.route.children} depth={props.depth + 1} onNavigate={props.onNavigate} />
          </div>
        </Show>
      </div>
    </Show>
  )
}

const NodeLink = (props: { route: Route; active: boolean; onNavigate?: () => void }) => (
  <A
    href={props.route.slug}
    class="flex-1 flex items-center gap-2 rounded-md px-1.5 py-1 text-mute hover:bg-hover hover:text-fg transition-colors min-w-0"
    classList={{ '!text-fg !bg-hover font-medium': props.active }}
    onClick={() => props.onNavigate?.()}
  >
    <KindCue route={props.route} />
    <span class="font-mono truncate">{props.route.title}</span>
  </A>
)

const indent = (depth: number): string => `${depth * 0.75}rem`

const KindCue = (props: { route: Route }) => {
  const project = useProject()
  const kind = () => (props.route.kind === 'doc' ? project().byId(props.route.decl)?.kind : undefined)
  return <Show when={kind()}>{(k) => <Type.KindBadge kind={k()} class="text-[0.7rem]! w-3.5 shrink-0" />}</Show>
}

const Chevron = (props: { open?: boolean }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 12 12"
    class="shrink-0 text-mute transition-transform"
    classList={{ 'rotate-90': props.open }}
    aria-hidden="true"
  >
    <path d="M4 2.5 7.5 6 4 9.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" />
  </svg>
)
