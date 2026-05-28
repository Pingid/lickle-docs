import { For, Show, createSignal } from 'solid-js'
import { A, useLocation } from '@solidjs/router'

import type { NavGroup, NavItem } from '../strategies/index.ts'
import { useNavGroups } from '../context/project.tsx'
import { createSlot } from '../context/index.ts'
import { shortOf } from '../util/kind.ts'
import { Type } from './Type.tsx'

/**
 * Collapsible navigation. Groups and module-bearing items start collapsed;
 * the node containing the active route auto-expands so the current page
 * sits in context. Manual toggles (chevron only) override the auto state
 * for the lifetime of the session.
 *
 * When a node has a `slug` (an entrypoint or a public sub-module), the
 * label acts as a plain link and the chevron stays responsible for
 * expanding — the two affordances are intentionally independent so users
 * can navigate without losing their current expansion state.
 */
export const Sidebar = createSlot('sidebar', (props: { onNavigate?: () => void; class?: string }) => {
  const navGroups = useNavGroups()
  const loc = useLocation()
  const [overrides, setOverrides] = createSignal<Record<string, boolean>>({})

  const path = () => loc.pathname
  const onPath = (slug?: string): boolean => !!slug && path() === `/r/${slug}`

  const isItemActive = (it: NavItem): boolean => onPath(it.slug) || !!it.children?.some(isItemActive)
  const isGroupActive = (g: NavGroup): boolean => onPath(g.slug) || g.items.some(isItemActive)

  const isOpen = (key: string, fallback: boolean): boolean => overrides()[key] ?? fallback
  const toggle = (key: string, open: boolean) => setOverrides((o) => ({ ...o, [key]: !open }))

  return (
    <aside class={`text-sm ${props.class ?? ''}`}>
      <nav class="pt-6 pb-12 px-4 space-y-1">
        <div class="mb-3">
          <A
            href="/"
            end
            class="block rounded-md px-2.5 py-1 text-mute hover:bg-hover hover:text-fg transition-colors"
            activeClass="!text-fg !bg-hover font-medium"
            onClick={() => props.onNavigate?.()}
          >
            Overview
          </A>
        </div>
        <For each={navGroups}>
          {(g) => {
            const key = `g:${g.title}`
            const open = () => isOpen(key, isGroupActive(g))
            return (
              <div>
                <GroupHeader
                  group={g}
                  open={open()}
                  onToggle={() => toggle(key, open())}
                  onNavigate={() => props.onNavigate?.()}
                />
                <Show when={open()}>
                  <ul class="mt-0.5 mb-1.5">
                    <For each={g.items}>
                      {(it) => (
                        <NavNode
                          item={it}
                          depth={1}
                          isItemActive={isItemActive}
                          isOpen={isOpen}
                          toggle={toggle}
                          onNavigate={() => props.onNavigate?.()}
                        />
                      )}
                    </For>
                  </ul>
                </Show>
              </div>
            )
          }}
        </For>
      </nav>
    </aside>
  )
})

// ============================================================================
// NODES
// `NavNode` is the recursive renderer used inside each group. Leaves render
// as a single link row; branches add a chevron + collapsible child list.
// ============================================================================

type NodeProps = {
  item: NavItem
  depth: number
  isItemActive: (it: NavItem) => boolean
  isOpen: (key: string, fallback: boolean) => boolean
  toggle: (key: string, open: boolean) => void
  onNavigate: () => void
}

const NavNode = (props: NodeProps) => {
  const key = () => `n:${props.item.id}`
  const hasChildren = () => !!props.item.children?.length
  const open = () => props.isOpen(key(), props.isItemActive(props.item))

  return (
    <li>
      <Show when={hasChildren()} fallback={<LeafRow {...props} />}>
        <BranchRow {...props} open={open()} onToggle={() => props.toggle(key(), open())} />
        <Show when={open()}>
          <ul>
            <For each={props.item.children!}>
              {(child) => <NavNode {...props} item={child} depth={props.depth + 1} />}
            </For>
          </ul>
        </Show>
      </Show>
    </li>
  )
}

const indent = (depth: number): string => `${0.625 + depth * 0.75}rem`

const LeafRow = (props: NodeProps) => (
  <Show
    when={props.item.slug}
    fallback={
      <span class="flex items-center gap-2 py-1 pr-2.5 text-mute" style={{ 'padding-left': indent(props.depth + 1) }}>
        <KindCue kind={props.item.kind} />
        <span class="font-mono truncate">{props.item.name}</span>
      </span>
    }
  >
    {(slug) => (
      <A
        href={`/r/${slug()}`}
        class="flex items-center gap-2 rounded-md pr-2.5 py-1 text-mute hover:bg-hover hover:text-fg transition-colors"
        style={{ 'padding-left': indent(props.depth + 1) }}
        activeClass="!text-fg !bg-hover font-medium"
        onClick={() => props.onNavigate()}
      >
        <KindCue kind={props.item.kind} />
        <span class="font-mono truncate">{props.item.name}</span>
      </A>
    )}
  </Show>
)

const BranchRow = (props: NodeProps & { open: boolean; onToggle: () => void }) => (
  <div class="flex items-center w-full" style={{ 'padding-left': indent(props.depth) }}>
    <button
      type="button"
      aria-label={props.open ? 'Collapse' : 'Expand'}
      aria-expanded={props.open}
      onClick={props.onToggle}
      class="p-1 rounded-md text-mute hover:bg-hover hover:text-fg transition-colors cursor-pointer"
    >
      <Chevron open={props.open} />
    </button>
    <Show
      when={props.item.slug}
      fallback={
        <span class="flex-1 flex items-center gap-2 px-1.5 py-1 text-mute">
          <KindCue kind={props.item.kind} />
          <span class="font-mono truncate">{props.item.name}</span>
        </span>
      }
    >
      {(slug) => (
        <A
          href={`/r/${slug()}`}
          class="flex-1 flex items-center gap-2 px-1.5 py-1 rounded-md text-mute hover:bg-hover hover:text-fg transition-colors"
          activeClass="!text-fg !bg-hover font-medium"
          onClick={() => props.onNavigate()}
        >
          <KindCue kind={props.item.kind} />
          <span class="font-mono truncate">{props.item.name}</span>
        </A>
      )}
    </Show>
  </div>
)

const KindCue = (props: { kind: NavItem['kind'] }) => (
  <Show when={shortOf(props.kind)}>
    <Type.KindBadge kind={props.kind} class="text-[0.7rem]! w-3.5" />
  </Show>
)

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

const headerClass =
  'group flex items-center gap-1.5 w-full px-2 py-1 rounded-md text-[0.7rem] uppercase tracking-wider font-semibold text-mute hover:bg-hover hover:text-fg transition-colors cursor-pointer'

const GroupHeader = (props: { group: NavGroup; open: boolean; onToggle: () => void; onNavigate: () => void }) => {
  if (props.group.slug) {
    return (
      <div class="flex items-center w-full">
        <button
          type="button"
          aria-label={props.open ? 'Collapse' : 'Expand'}
          aria-expanded={props.open}
          onClick={props.onToggle}
          class="p-1.5 rounded-md text-mute hover:bg-hover hover:text-fg transition-colors cursor-pointer"
        >
          <Chevron open={props.open} />
        </button>
        <A
          href={`/r/${props.group.slug}`}
          class="flex-1 px-1.5 py-1 rounded-md text-[0.7rem] uppercase tracking-wider font-semibold text-mute hover:bg-hover hover:text-fg transition-colors truncate"
          activeClass="!text-fg !bg-hover"
          onClick={props.onNavigate}
        >
          {props.group.title}
        </A>
      </div>
    )
  }

  return (
    <button type="button" aria-expanded={props.open} onClick={props.onToggle} class={headerClass}>
      <Chevron open={props.open} />
      <span class="truncate">{props.group.title}</span>
    </button>
  )
}
