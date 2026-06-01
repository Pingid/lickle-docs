import { For, Show, createEffect, createMemo, createResource, createSignal, on, onCleanup } from 'solid-js'
import { useNavigate } from '@solidjs/router'

import { useProject, type Types } from '../context/index.ts'
import { type SearchHit } from '../util/search.ts'
import { useSearch } from '../hooks/index.ts'
import { type Kind } from '../util/kind.ts'
import { Type } from './Type.tsx'

const DEBOUNCE_MS = 80
const DEFAULT_LIMIT = 12

export const SearchPalette = (props: { open: () => boolean; onClose: () => void }) => {
  const navigate = useNavigate()
  const search = useSearch()
  const project = useProject()

  const [engine] = createResource(props.open, async (isOpen) => (isOpen ? await search() : undefined))

  const [term, setTerm] = createSignal('')
  const [debounced, setDebounced] = createSignal('')
  const [highlight, setHighlight] = createSignal(0)
  let inputRef!: HTMLInputElement

  createEffect(() => {
    const t = term()
    const timer = setTimeout(() => setDebounced(t), DEBOUNCE_MS)
    onCleanup(() => clearTimeout(timer))
  })

  createEffect(
    on(props.open, (isOpen) => {
      if (!isOpen) return
      setTerm('')
      setDebounced('')
      setHighlight(0)
      queueMicrotask(() => inputRef?.focus())
    }),
  )

  const [hits] = createResource(
    () => [engine(), debounced()] as const,
    async ([e, t]) => (e ? await e.query(t) : []),
  )

  // Before the user types, suggest the first module's entries so the palette
  // opens with something to browse instead of an empty box.
  const firstModule = createMemo(() => project().routes.find((r) => r.nav && r.page.kind !== 'markdown'))
  const suggestions = createMemo<SearchHit[]>(() => {
    const mod = firstModule()
    return mod ? childHits(project(), mod).slice(0, DEFAULT_LIMIT) : []
  })

  const hasTerm = () => debounced().trim().length > 0
  const list = createMemo<SearchHit[]>(() => (hasTerm() ? (hits() ?? []) : suggestions()))

  createEffect(
    on(list, (l) => {
      if (highlight() >= l.length) setHighlight(0)
    }),
  )

  const choose = (hit: SearchHit) => {
    navigate(`/${hit.slug}`)
    props.onClose()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const l = list()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (l.length) setHighlight((i) => (i + 1) % l.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (l.length) setHighlight((i) => (i - 1 + l.length) % l.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = l[highlight()]
      if (hit) choose(hit)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      props.onClose()
    }
  }

  return (
    <Show when={props.open()}>
      <div
        class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4"
        onClick={() => props.onClose()}
        role="presentation"
      >
        <div
          class="w-full max-w-xl mt-[12vh] bg-bg border border-line rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Search"
        >
          <div class="flex items-center gap-3 px-4 py-3.5 border-b border-line">
            <SearchGlyph class="text-mute shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={term()}
              onInput={(e) => setTerm(e.currentTarget.value)}
              onKeyDown={onKeyDown}
              placeholder="Search functions, types, classes…"
              class="flex-1 bg-transparent outline-none text-[0.95rem] placeholder:text-mute"
              autocomplete="off"
              spellcheck={false}
            />
            <Kbd>esc</Kbd>
          </div>

          <Show when={list().length} fallback={<EmptyState loading={engine.loading} term={debounced()} />}>
            <Show when={!hasTerm() && firstModule()}>
              {(mod) => (
                <p class="px-5 pt-3 pb-1 text-[0.7rem] uppercase tracking-wider font-semibold text-mute">
                  {mod().label}
                </p>
              )}
            </Show>
            <ul class="flex-1 overflow-y-auto p-2" role="listbox">
              <For each={list()}>
                {(hit, i) => (
                  <li
                    role="option"
                    aria-selected={i() === highlight()}
                    class="group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer scroll-mt-2"
                    classList={{ 'bg-hover': i() === highlight() }}
                    onMouseEnter={() => setHighlight(i())}
                    onClick={() => choose(hit)}
                  >
                    <span
                      class="flex items-center justify-center w-6 h-6 rounded-md border border-line bg-hover/50 shrink-0"
                      classList={{ 'border-accent/40': i() === highlight() }}
                    >
                      <Type.KindBadge kind={hit.kind} class="w-3.5" />
                    </span>
                    <span class="font-mono font-semibold text-sm shrink-0">{hit.name}</span>
                    <Show when={hit.qualified && hit.qualified !== hit.name}>
                      <span class="font-mono text-xs text-mute truncate">{hit.qualified}</span>
                    </Show>
                    <Show when={hit.file}>
                      <span class="font-mono text-[0.7rem] text-mute truncate ml-auto pl-3 opacity-70">{hit.file}</span>
                    </Show>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      class="shrink-0 text-mute transition-opacity"
                      classList={{ 'opacity-0': i() !== highlight(), 'opacity-100': i() === highlight() }}
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </li>
                )}
              </For>
            </ul>
          </Show>

          <div class="flex items-center gap-4 px-4 py-2 border-t border-line text-[0.7rem] text-mute">
            <span class="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <span>navigate</span>
            </span>
            <span class="flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              <span>open</span>
            </span>
            <Show when={list().length}>
              <span class="ml-auto tabular-nums">
                {list().length} result{list().length === 1 ? '' : 's'}
              </span>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}

/** Map a route's direct children into search-hit rows for the default listing. */
const childHits = (project: Types.Project, route: Types.RouteNode): SearchHit[] => {
  const out: SearchHit[] = []
  for (const child of route.children) {
    if (child.page.kind === 'markdown') continue
    const decl = project.byId(child.page.id)
    out.push({
      name: child.label,
      qualified: child.page.qualified,
      kind: (decl?.kind ?? 'module') as Kind,
      slug: child.slug,
      file: decl?.sources?.[0]?.file ?? '',
    })
  }
  return out
}

const EmptyState = (props: { loading: boolean; term: string }) => (
  <div class="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6 py-16">
    <Show
      when={!props.loading}
      fallback={
        <>
          <Spinner />
          <p class="text-sm text-mute">Building search index…</p>
        </>
      }
    >
      <div class="flex items-center justify-center w-12 h-12 rounded-full bg-hover text-mute">
        <SearchGlyph size={22} />
      </div>
      <Show
        when={props.term}
        fallback={
          <>
            <p class="text-sm font-medium text-fg">Search the API</p>
            <p class="text-xs text-mute max-w-xs leading-relaxed">
              Jump to any function, type, class or interface by name.
            </p>
          </>
        }
      >
        <p class="text-sm font-medium text-fg">
          No matches for <span class="font-mono">“{props.term}”</span>
        </p>
        <p class="text-xs text-mute">Try a shorter or different term.</p>
      </Show>
    </Show>
  </div>
)

const Kbd = (props: { children: any }) => (
  <kbd class="font-mono text-[0.65rem] text-mute bg-hover border border-line rounded px-1.5 py-0.5 leading-none">
    {props.children}
  </kbd>
)

const SearchGlyph = (props: { class?: string; size?: number }) => (
  <svg
    width={props.size ?? 16}
    height={props.size ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    class={props.class}
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" stroke-linecap="round" />
  </svg>
)

const Spinner = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="animate-spin text-mute" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" class="opacity-25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  </svg>
)
