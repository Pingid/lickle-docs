import { For, Show, createMemo, createSignal } from 'solid-js'
import { A, useLocation } from '@solidjs/router'

import * as docs from '../../core/client.ts'

import { createSlot, useProj } from '../context/index.ts'
import { Type } from './Type.tsx'

type Node = docs.RouteNode

export const Sidebar = createSlot('sidebar', (props: { onNavigate?: () => void; class?: string }) => {
  const project = useProj()
  const routes = createMemo(() => project().routes.filter((r) => r.nav))

  return (
    <aside class={`text-sm ${props.class ?? ''}`}>
      <nav class="pt-6 pb-12 px-3 space-y-0.5">
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
          <GroupHeader label={node.group!} depth={props.depth} />
        </Show>
        <NavNode node={node} depth={props.depth} onNavigate={props.onNavigate} />
      </>
    )}
  </For>
)

const GroupHeader = (props: { label: string; depth: number }) => (
  <div
    class="pt-4 pb-1 px-2 text-[0.7rem] uppercase tracking-wider font-semibold text-mute first:pt-1"
    style={{ 'padding-left': indent(props.depth) }}
  >
    {props.label}
  </div>
)

type NodeProps = { node: Node; depth: number; onNavigate?: () => void }

const NavNode = (props: NodeProps) => {
  const loc = useLocation()
  const kids = createMemo(() => props.node.children.filter((c) => c.nav))
  const hasChildren = () => kids().length > 0
  const isActive = () => loc.pathname === `/${props.node.slug}`
  const [open, setOpen] = createSignal(false)

  return (
    <div>
      <div class="flex items-center" style={{ 'padding-left': indent(props.depth) }}>
        <Show when={hasChildren()} fallback={<span class="w-5 shrink-0" />}>
          <button
            type="button"
            aria-label={open() ? 'Collapse' : 'Expand'}
            aria-expanded={open()}
            onClick={() => setOpen((v) => !v)}
            class="p-1 rounded-md text-mute hover:bg-hover hover:text-fg transition-colors cursor-pointer"
          >
            <Chevron open={open()} />
          </button>
        </Show>
        <A
          href={`/${props.node.slug}`}
          class="flex-1 flex items-center gap-2 rounded-md px-1.5 py-1 text-mute hover:bg-hover hover:text-fg transition-colors min-w-0"
          classList={{ '!text-fg !bg-hover font-medium': isActive() }}
          onClick={() => props.onNavigate?.()}
        >
          <KindCue node={props.node} />
          <span class="font-mono truncate">{props.node.label}</span>
        </A>
      </div>
      <Show when={hasChildren() && open()}>
        <NavList nodes={kids()} depth={props.depth + 1} onNavigate={props.onNavigate} />
      </Show>
    </div>
  )
}

const indent = (depth: number): string => `${depth * 0.75}rem`

const KindCue = (props: { node: Node }) => {
  const project = useProj()
  const kind = () => {
    const page = props.node.page
    if (page.kind === 'markdown') return undefined
    return project().byId(page.id)?.kind
  }
  return <Show when={kind()}>{(k) => <Type.KindBadge kind={k()} class="text-[0.7rem]! w-3.5 shrink-0" />}</Show>
}

const Chevron = (props: { open: boolean }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 12 12"
    class={`shrink-0 text-mute transition-transform ${props.open ? 'rotate-90' : ''}`}
    aria-hidden="true"
  >
    <path d="M4 2.5 7.5 6 4 9.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" />
  </svg>
)
