import { For, Show, createMemo } from 'solid-js'
import { A, useLocation } from '../context/router.tsx'

import { createSlot, useProject, type Types } from '../context/index.tsx'
import { Type } from './Type.tsx'

type Node = Types.RouteNode

export const Sidebar = createSlot('sidebar', (props: { onNavigate?: () => void; class?: string }) => {
  const project = useProject()
  const routes = createMemo(() => project().routes.filter((r) => r.sidebar))

  return (
    <aside class={`text-[0.8125rem] ${props.class ?? ''}`}>
      <nav class="pt-5 pb-10 px-2.5 space-y-0.5">
        <NavList nodes={routes()} depth={0} onNavigate={props.onNavigate} />
      </nav>
    </aside>
  )
})

/** A list of sibling routes, with a `group` header inserted whenever it changes. */
const NavList = (props: { nodes: Node[]; depth: number; onNavigate?: () => void }) => (
  <For each={props.nodes}>
    {(node, i) => (
      <>
        <Show when={node.group && node.group !== props.nodes[i() - 1]?.group}>
          <GroupLabel label={node.group!} depth={props.depth} />
        </Show>
        <NavNode node={node} depth={props.depth} onNavigate={props.onNavigate} />
      </>
    )}
  </For>
)

/** A non-interactive section heading shown above a run of related routes. */
const GroupLabel = (props: { label: string; depth: number }) => (
  <div
    class="pr-2 pt-4 pb-1 text-[0.6875rem] font-medium text-mute/55 select-none first:pt-1"
    style={{ 'padding-left': `calc(${indent(props.depth)} + 1.625rem)` }}
  >
    {props.label}
  </div>
)

type NodeProps = { node: Node; depth: number; onNavigate?: () => void }

/**
 * A single navigation node.
 *
 * - A *group* node (no page / no slug) is a non-collapsible section: a
 *   {@link GroupLabel} heading with its children rendered flush beneath it.
 * - A *route* with children renders as a native `<details>` so expand/collapse
 *   works with zero JavaScript; the branch on the active path is open by
 *   default (slugs are hierarchical, so the active page lives under its prefix).
 * - A leaf route is a plain link.
 */
const NavNode = (props: NodeProps) => {
  const loc = useLocation()
  const kids = createMemo(() => props.node.children.filter((c) => c.sidebar))
  const isGroup = () => props.node.page === undefined || props.node.slug === undefined
  const base = () => (props.node.slug ? `/${props.node.slug}` : undefined)
  const isActive = () => !!base() && loc.pathname === base()
  const onPath = () => isActive() || (!!base() && loc.pathname.startsWith(`${base()}/`))

  if (isGroup())
    return (
      <Show when={kids().length}>
        <div>
          <GroupLabel label={props.node.label} depth={props.depth} />
          <NavList nodes={kids()} depth={props.depth} onNavigate={props.onNavigate} />
        </div>
      </Show>
    )

  return (
    <Show
      when={kids().length}
      fallback={
        <div class="flex items-center" style={{ 'padding-left': indent(props.depth) }}>
          <span class="w-5 shrink-0" />
          <NodeLink {...props} active={isActive()} />
        </div>
      }
    >
      <details open={onPath()} class="group">
        <summary
          class="flex items-center list-none cursor-pointer [&::-webkit-details-marker]:hidden"
          style={{ 'padding-left': indent(props.depth) }}
        >
          <span class="p-1 rounded-md text-mute hover:bg-hover hover:text-fg transition-colors">
            <Chevron />
          </span>
          <NodeLink {...props} active={isActive()} />
        </summary>
        <NavList nodes={kids()} depth={props.depth + 1} onNavigate={props.onNavigate} />
      </details>
    </Show>
  )
}

const NodeLink = (props: NodeProps & { active: boolean }) => (
  <A
    href={`/${props.node.slug ?? ''}`}
    class="flex-1 flex items-center gap-2 rounded-md px-1.5 py-1 text-mute hover:bg-hover hover:text-fg transition-colors min-w-0"
    classList={{ '!text-fg !bg-hover font-medium': props.active }}
    onClick={() => props.onNavigate?.()}
  >
    <KindCue node={props.node} />
    <span class="font-mono truncate">{props.node.label}</span>
  </A>
)

const indent = (depth: number): string => `${depth * 0.75}rem`

const KindCue = (props: { node: Node }) => {
  const project = useProject()
  const kind = () => {
    const page = props.node.page
    if (!page || page.kind === 'markdown') return undefined
    return project().byId(page.id)?.kind
  }
  return <Show when={kind()}>{(k) => <Type.KindBadge kind={k()} class="text-[0.7rem]! w-3.5 shrink-0" />}</Show>
}

const Chevron = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 12 12"
    class="shrink-0 text-mute transition-transform group-open:rotate-90"
    aria-hidden="true"
  >
    <path d="M4 2.5 7.5 6 4 9.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" />
  </svg>
)
