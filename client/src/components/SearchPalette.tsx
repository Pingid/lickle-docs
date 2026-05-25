import { For, Show, createEffect, createMemo, createResource, createSignal, on, onCleanup } from 'solid-js'
import { useNavigate } from '@solidjs/router'

import { createSearchEngine, type SearchHit } from '../util/search.js'
import { labelOf, shortOf } from '../util/kind.js'
import { useIndex } from '../context/index.js'

const DEBOUNCE_MS = 80

export const SearchPalette = (props: { open: () => boolean; onClose: () => void }) => {
  const idx = useIndex()
  const navigate = useNavigate()

  const [engine] = createResource(props.open, async (isOpen) => (isOpen ? createSearchEngine(idx) : undefined))

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

  const list = createMemo<SearchHit[]>(() => hits() ?? [])

  createEffect(
    on(list, (l) => {
      if (highlight() >= l.length) setHighlight(0)
    }),
  )

  const choose = (hit: SearchHit) => {
    navigate(`/r/${hit.slug}`)
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
      <div class="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={() => props.onClose()} role="presentation">
        <div
          class="max-w-xl w-[calc(100%-2rem)] mx-auto mt-24 bg-bg border border-line rounded-lg shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Search"
        >
          <div class="flex items-center gap-3 px-4 py-3 border-b border-line">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              class="text-mute shrink-0"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" stroke-linecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={term()}
              onInput={(e) => setTerm(e.currentTarget.value)}
              onKeyDown={onKeyDown}
              placeholder="Search symbols..."
              class="flex-1 bg-transparent outline-none text-sm placeholder:text-mute"
              autocomplete="off"
              spellcheck={false}
            />
            <kbd class="font-mono text-[0.65rem] text-mute border border-line rounded px-1.5 py-0.5">esc</kbd>
          </div>

          <Show
            when={list().length}
            fallback={
              <div class="px-4 py-8 text-center text-sm text-mute">
                <Show when={engine.loading} fallback={debounced() ? 'No matches.' : 'Start typing to search.'}>
                  Building index…
                </Show>
              </div>
            }
          >
            <ul class="max-h-[60vh] overflow-y-auto py-1" role="listbox">
              <For each={list()}>
                {(hit, i) => (
                  <li
                    role="option"
                    aria-selected={i() === highlight()}
                    class="flex items-baseline gap-3 px-4 py-2 cursor-pointer"
                    classList={{ 'bg-hover': i() === highlight() }}
                    onMouseEnter={() => setHighlight(i())}
                    onClick={() => choose(hit)}
                  >
                    <span class="font-mono text-xs text-mute w-4 text-center shrink-0" title={labelOf(hit.kind)}>
                      {shortOf(hit.kind)}
                    </span>
                    <span class="font-mono font-semibold text-sm truncate">{hit.name}</span>
                    <Show when={hit.qualified && hit.qualified !== hit.name}>
                      <span class="font-mono text-xs text-mute truncate ml-auto">{hit.qualified}</span>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </div>
    </Show>
  )
}
