import { For, Show, createMemo } from 'solid-js'

import { useProject, createSlot } from '../context/index.tsx'
import { useVersions } from '../hooks/index.ts'
import { LinkButton, SearchIcon, ChevronIcon } from './icons.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
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
        <A href="/" class="hover:opacity-70 transition-opacity">
          <span class="font-semibold text-[0.95rem] tracking-tight">{project().name}</span>
        </A>
        <VersionSelect />

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

/** Current version label, upgraded to a switcher when a manifest lists other versions. */
const VersionSelect = () => {
  const project = useProject()
  const versions = useVersions()
  const aliasOf = (v: { version: string; alias?: string }) => v.alias ?? v.version
  const current = () => versions().find((v) => v.version === project().version)
  const label = () => `v${current() ? aliasOf(current()!) : project().version}`

  return (
    <Show when={project().version}>
      <Show when={versions().length} fallback={<span class="text-xs text-mute font-mono">{label()}</span>}>
        <details class="relative group text-xs font-mono">
          <summary class="list-none flex items-center gap-1 px-1.5 py-1 rounded-md text-mute hover:text-fg hover:bg-hover cursor-pointer">
            {label()}
            <ChevronIcon size={12} class="transition-transform group-open:rotate-180" />
          </summary>
          <ul class="absolute left-0 mt-1 min-w-28 py-1 rounded-md border border-line bg-bg shadow-lg">
            <For each={versions()}>
              {(v) => (
                <li>
                  <a
                    href={versionHref(v.href)}
                    rel="external"
                    aria-current={v.version === project().version ? 'true' : undefined}
                    class="block px-3 py-1.5 text-mute hover:text-fg hover:bg-hover aria-current:text-fg aria-current:font-semibold"
                  >
                    {aliasOf(v)}
                  </a>
                </li>
              )}
            </For>
          </ul>
        </details>
      </Show>
    </Show>
  )
}

/** Internal version roots need a trailing slash so the static server serves their `index.html`. */
const versionHref = (href: string) => (/^https?:\/\//.test(href) || href.endsWith('/') ? href : `${href}/`)

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
