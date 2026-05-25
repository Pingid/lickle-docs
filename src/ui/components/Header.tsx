import { For, Show, createMemo } from 'solid-js'
import { A } from '@solidjs/router'

import { useProject } from '../context/index.tsx'
import { createSlot } from '../context/index.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { withBaseUrl } from '../util/base.ts'

const isMac = () => typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '')

const ICON_BY_NAME: Record<string, string> = {
  github: 'github-icon',
  bluesky: 'bluesky-icon',
  discord: 'discord-icon',
  x: 'x-icon',
  twitter: 'x-icon',
  npm: 'documentation-icon',
}

const iconFor = (label: string): string | null => {
  const k = label.toLowerCase()
  return ICON_BY_NAME[k] ?? null
}

export const Header = createSlot('header', (props: { onMenu?: () => void; onSearch?: () => void }) => {
  const project = useProject()
  const searchHint = createMemo(() => (isMac() ? '\u2318K' : 'Ctrl K'))

  return (
    <header class="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md backdrop-saturate-150">
      <div class="flex items-center h-14 px-4 lg:px-6 gap-4">
        <button
          type="button"
          aria-label="Open menu"
          class="lg:hidden p-1.5 rounded hover:bg-hover cursor-pointer"
          onClick={() => props.onMenu?.()}
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
        </button>
        <A href="/" class="flex items-baseline gap-2 hover:opacity-70 transition-opacity">
          <span class="font-semibold text-[0.95rem] tracking-tight">{project().name}</span>
          <Show when={project().version}>
            <span class="text-xs text-mute font-mono">v{project().version}</span>
          </Show>
        </A>

        <button
          type="button"
          onClick={() => props.onSearch?.()}
          aria-label="Search"
          class="ml-4 flex items-center gap-2 px-2.5 py-1 text-xs text-mute border border-line rounded-md hover:text-fg hover:bg-hover transition-colors cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" stroke-linecap="round" />
          </svg>
          <span class="hidden sm:inline">Search</span>
          <kbd class="font-mono text-[0.65rem] text-mute">{searchHint()}</kbd>
        </button>

        <nav class="ml-auto flex items-center gap-1">
          <For each={project().links}>
            {({ label, href }) => {
              const icon = iconFor(label)
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  class="flex items-center gap-1.5 px-2 py-1 text-xs text-mute hover:text-fg transition-colors duration-150"
                  title={label}
                >
                  <Show when={icon} fallback={<span>{label}</span>}>
                    <svg width="14" height="14">
                      <use href={withBaseUrl(`icons.svg#${icon}`)} />
                    </svg>
                    <span class="sr-only">{label}</span>
                  </Show>
                </a>
              )
            }}
          </For>
          <div class="ml-2">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  )
})
