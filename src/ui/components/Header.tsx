import { For, Show, createEffect, createMemo } from 'solid-js'
import cn from '@lickle/cn'

import {
  type Reflect,
  useDocVersions,
  useDocVersionsCurrent,
  createSlot,
  useLoadVersion,
  useDocs,
} from '../context/index.tsx'
import { LinkButton, SearchIcon, ChevronIcon } from './icons.tsx'
import { A, useNavigate } from '../util/router.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { clientOnly } from '../util/solid.tsx'

const isMac = () => typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '')

/**
 * id of the CSS-only drawer toggle checkbox; the mobile menu `<label>` targets it.
 * @internal
 */
export const MENU_TOGGLE_ID = 'lickle-menu-toggle'

/**
 * Top bar: project name, version switcher (when several versions are
 * configured), search trigger, the config's `links` and the theme toggle.
 * Replaceable via the `header` slot.
 * @group components
 */
export const Header = createSlot('header', (props) => {
  const docs = useDocs()
  return (
    <header class="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md backdrop-saturate-150">
      <div class="flex items-center h-(--header-height) px-4 lg:px-6 gap-4">
        <label
          for={MENU_TOGGLE_ID}
          aria-label="Toggle menu"
          class="lg:hidden p-1.5 rounded hover:bg-hover cursor-pointer"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </label>
        <Show when={docs.name()}>
          {(name) => (
            <A href="/" class="hover:opacity-70 transition-opacity">
              <span class="font-semibold text-[0.95rem] tracking-tight">{name()}</span>
            </A>
          )}
        </Show>
        <VersionSelect />

        <nav class="ml-auto flex items-center">
          <div class="pr-4">
            <SearchButton onSearch={props.onSearch} />
          </div>
          <For each={docs.links()}>{(link) => <LinkButton link={link} class="px-2 py-1 text-xs" />}</For>
          <div class="ml-2">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  )
})

/** Current version label, upgraded to a switcher when more than one version exists. */
const VersionSelect = () => {
  const versions = useDocVersions()
  const active = useDocVersionsCurrent()
  const load = useLoadVersion()
  const nav = useNavigate()

  const aliasOf = (v?: Reflect.DocsVersion) => v?.alias ?? v?.version
  const label = () => `v${aliasOf(active()) ?? versions()[0]?.version ?? ''}`

  let details: HTMLDetailsElement | undefined
  const close = () => details && (details.open = false)

  createEffect(() => {
    const j = load.json()
    const v = load.version()
    if (j && v) {
      nav(v.slug)
      close()
    }
  })

  return (
    <Show when={versions().length > 1} fallback={<span class="text-xs text-mute font-mono">{label()}</span>}>
      <details ref={details} class="relative group text-xs font-mono">
        <summary class="list-none flex items-center gap-1 px-1.5 py-1 rounded-md text-mute hover:text-fg hover:bg-hover cursor-pointer">
          {label()}
          <ChevronIcon size={12} class="transition-transform group-open:rotate-180" />
        </summary>
        <ul class="absolute left-0 mt-1 min-w-28 py-1 rounded-md border border-line bg-bg shadow-lg">
          <For each={versions()}>
            {(v) => (
              <li>
                <A
                  href={v.slug}
                  onClick={(e) => {
                    e.preventDefault()
                    load.load(v)
                  }}
                  aria-current={v.slug === active()?.slug ? 'true' : undefined}
                  class={cn(
                    [load.loading() && load.version() === v, 'animate-pulse'],
                    [load.loading() && load.version() !== v, 'opacity-50'],
                    'block px-3 py-1.5 text-mute hover:text-fg hover:bg-hover aria-current:text-fg aria-current:font-semibold',
                  )}
                >
                  {aliasOf(v)}
                </A>
              </li>
            )}
          </For>
        </ul>
      </details>
    </Show>
  )
}

const SearchButton = clientOnly(() => (props: { onSearch?: () => void }) => {
  const searchHint = createMemo(() => (isMac() ? '\u2318K' : 'Ctrl K'))

  return (
    <button
      type="button"
      onClick={() => props.onSearch?.()}
      aria-label="Search"
      class="ml-4 flex items-center gap-2 mt-0.5 px-2.5 py-1.5 text-xs text-mute border border-line rounded-md hover:text-fg hover:bg-hover transition-colors cursor-pointer"
    >
      <SearchIcon size={13} />
      <span class="hidden sm:inline pr-3">Search</span>
      <kbd class="font-mono text-[0.65rem] text-mute mr-1">{searchHint()}</kbd>
    </button>
  )
})
