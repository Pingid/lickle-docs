import { For, Show, createEffect, createMemo, createResource, createSignal, on, onCleanup } from 'solid-js'
import { useNavigate } from '../util/router.tsx'

import { DocRouter, useSearch, type SearchHit } from '../hooks/index.ts'
import { SearchIcon } from './icons.tsx'
import * as Type from './Type.tsx'

const DEBOUNCE_MS = 80
// const DEFAULT_LIMIT = 12
const RECENTS_KEY = 'lickle:recent-search'
const RECENTS_MAX = 8

/** Read the persisted recent selections, tolerating SSR and corrupt storage. */
const loadRecents = (): SearchHit[] => {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as SearchHit[]) : []
  } catch {
    return []
  }
}

const saveRecents = (hits: SearchHit[]): void => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(hits))
  } catch {
    // storage unavailable or over quota — recents are best-effort
  }
}

export const SearchPalette = (props: { open: () => boolean; onClose: () => void }) => {
  const navigate = useNavigate()
  const router = DocRouter.use()
  const search = useSearch()

  // Track `search()` reactively (not a one-shot capture): if the palette opens
  // before the index has finished building, the engine swaps from the empty
  // fallback to the real one as soon as it's ready.
  const [engine] = createResource(
    () => (props.open() ? search() : undefined),
    async (e) => e,
  )

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
      const prev = document.activeElement as HTMLElement | null
      setTerm('')
      setDebounced('')
      setHighlight(0)
      queueMicrotask(() => inputRef?.focus())
      // Restore focus to the trigger (or whatever was focused) when the palette closes.
      onCleanup(() => prev?.focus?.())
    }),
  )

  // Keep the highlighted result visible during keyboard navigation. `nearest`
  // is a no-op when the option is already on screen (e.g. on mouse hover).
  let optionEls: (HTMLElement | undefined)[] = []
  createEffect(() => optionEls[highlight()]?.scrollIntoView({ block: 'nearest' }))

  const [hits] = createResource(
    () => [engine(), debounced()] as const,
    async ([e, t]) => (e ? await e.query(t) : []),
  )

  // Recently selected items, persisted across sessions. Stale entries (routes
  // that no longer exist after a rebuild) are filtered out.
  const [recents, setRecents] = createSignal<SearchHit[]>(loadRecents())
  const validRecents = createMemo(() => recents().filter((h) => router()?.get({ slug: h.slug })))

  const hasTerm = () => debounced().trim().length > 0
  const sectionLabel = () => (validRecents().length ? 'Recent' : '')
  const list = createMemo<SearchHit[]>(() => (hasTerm() ? (hits() ?? []) : validRecents().length ? validRecents() : []))

  createEffect(
    on(list, (l) => {
      if (highlight() >= l.length) setHighlight(0)
    }),
  )

  const choose = (hit: SearchHit) => {
    const next = [hit, ...recents().filter((h) => h.slug !== hit.slug)].slice(0, RECENTS_MAX)
    setRecents(next)
    saveRecents(next)
    navigate(hit.slug)
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
          aria-modal="true"
          aria-label="Search"
        >
          <div class="flex items-center gap-3 px-4 py-3.5 border-b border-line">
            <SearchIcon class="text-mute shrink-0" />
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
            <Show when={!hasTerm() && sectionLabel()}>
              <p class="px-5 pt-3 pb-1 text-[0.7rem] uppercase tracking-wider font-semibold text-mute">
                {sectionLabel()}
              </p>
            </Show>
            <ul class="flex-1 overflow-y-auto p-2" role="listbox">
              <For each={list()}>
                {(hit, i) => (
                  <li
                    ref={(el) => (optionEls[i()] = el)}
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
                    <Show when={hit.group}>
                      <span class="text-[0.7rem] text-mute px-1.5 py-0.5 rounded border border-line bg-hover/50 shrink-0">
                        {hit.group}
                      </span>
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
        <SearchIcon size={22} />
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

const Spinner = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="animate-spin text-mute" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" class="opacity-25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  </svg>
)
