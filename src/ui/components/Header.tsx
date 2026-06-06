import { For, Show, createMemo } from 'solid-js'

import { useProject } from '../context/index.tsx'
import { createSlot } from '../context/index.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { LinkButton, SearchIcon } from './icons.tsx'
import { clientOnly } from '../util/solid.tsx'
import { A } from '../context/router.tsx'

const isMac = () => typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '')

/** id of the CSS-only drawer toggle checkbox; the mobile menu `<label>` targets it. */
export const MENU_TOGGLE_ID = 'lickle-menu-toggle'

export const Header = createSlot('header', (props: { onSearch?: () => void }) => {
  const project = useProject()

  return (
    <header class="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md backdrop-saturate-150">
      <div class="flex items-center h-14 px-4 lg:px-6 gap-4">
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
        <A href="/" class="flex items-baseline gap-2 hover:opacity-70 transition-opacity">
          <span class="font-semibold text-[0.95rem] tracking-tight">{project().name}</span>
          <Show when={project().version}>
            <span class="text-xs text-mute font-mono">v{project().version}</span>
          </Show>
        </A>

        <nav class="ml-auto flex items-center">
          <div class="pr-4">
            <SearchButton onSearch={props.onSearch} />
          </div>
          <For each={project().links}>{(link) => <LinkButton link={link} class="px-2 py-1 text-xs" />}</For>
          <div class="ml-2">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  )
})

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
