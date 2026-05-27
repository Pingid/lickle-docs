import { For, Show, createSignal } from 'solid-js'
import { A, useLocation } from '@solidjs/router'

import { useNavGroups } from '../context/index.js'
import type { NavGroup } from '../util/project.js'
import { shortOf } from '../util/kind.js'
import { KindBadge } from '../primitives/Kind.js'

/**
 * Collapsible navigation. Groups start collapsed; the group containing the
 * active route auto-expands so the current page sits in context. Manual
 * toggles (chevron only) override the auto state for the lifetime of the
 * session.
 *
 * When a group has a `slug` (e.g. an export entrypoint that maps to a
 * module), the title acts as a plain link to that module page — clicking
 * it never expands the group; that's the chevron's job.
 */
export const Sidebar = (props: { onNavigate?: () => void; class?: string }) => {
  const navGroups = useNavGroups()
  const loc = useLocation()
  const [overrides, setOverrides] = createSignal<Record<string, boolean>>({})

  const isActive = (g: NavGroup): boolean => {
    const path = loc.pathname
    if (g.slug && path === `/r/${g.slug}`) return true
    return g.items.some((it) => path === `/r/${it.slug}`)
  }

  const isOpen = (g: NavGroup): boolean => {
    const ov = overrides()[g.title]
    return ov !== undefined ? ov : isActive(g)
  }

  const toggle = (g: NavGroup) => setOverrides((o) => ({ ...o, [g.title]: !isOpen(g) }))

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
          {(g) => (
            <div>
              <GroupHeader
                group={g}
                open={isOpen(g)}
                onToggle={() => toggle(g)}
                onNavigate={() => props.onNavigate?.()}
              />
              <Show when={isOpen(g)}>
                <ul class="mt-0.5 mb-1.5">
                  <For each={g.items}>
                    {(it) => (
                      <li>
                        <A
                          href={`/r/${it.slug}`}
                          class="flex items-center gap-2 rounded-md pl-7 pr-2.5 py-1 text-mute hover:bg-hover hover:text-fg transition-colors"
                          activeClass="!text-fg !bg-hover font-medium"
                          onClick={() => props.onNavigate?.()}
                        >
                          <Show when={shortOf(it.kind)}>
                          <KindBadge kind={it.kind} class="!text-[0.7rem] w-3.5" />
                        </Show>
                          <span class="font-mono truncate">{it.name}</span>
                        </A>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </div>
          )}
        </For>
      </nav>
    </aside>
  )
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

const headerClass =
  'group flex items-center gap-1.5 w-full px-2 py-1 rounded-md text-[0.7rem] uppercase tracking-wider font-semibold text-mute hover:bg-hover hover:text-fg transition-colors cursor-pointer'

const GroupHeader = (props: {
  group: NavGroup
  open: boolean
  onToggle: () => void
  onNavigate: () => void
}) => {
  // Linkable title: chevron toggles, label navigates. The two affordances
  // are intentionally independent so the user can navigate without losing
  // their current expansion state.
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
    <button
      type="button"
      aria-expanded={props.open}
      onClick={props.onToggle}
      class={headerClass}
    >
      <Chevron open={props.open} />
      <span class="truncate">{props.group.title}</span>
    </button>
  )
}
