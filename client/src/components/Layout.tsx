import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

import { useLocation } from '@solidjs/router'
import { createEffect } from 'solid-js'

import { SearchPalette } from './SearchPalette.js'
import { Sidebar } from './Sidebar.js'
import { Header } from './Header.js'

export const Layout = (props: { children: JSX.Element }) => {
  const [menuOpen, setMenuOpen] = createSignal(false)
  const [searchOpen, setSearchOpen] = createSignal(false)
  const loc = useLocation()
  createEffect(() => {
    void loc.pathname
    setMenuOpen(false)
  })

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    onCleanup(() => window.removeEventListener('keydown', onKey))
  })

  return (
    <div class="min-h-screen flex flex-col">
      <Header onMenu={() => setMenuOpen((v) => !v)} onSearch={() => setSearchOpen(true)} />

      <div class="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr] max-w-[1400px] w-full mx-auto">
        <Sidebar class="hidden lg:block border-r border-line sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto" />

        <Show when={menuOpen()}>
          <div class="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMenuOpen(false)}>
            <div
              class="absolute inset-y-0 left-0 w-72 bg-bg border-r border-line overflow-y-auto pt-14"
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        </Show>

        <main class="min-w-0 px-6 lg:px-12 pt-8 pb-20 max-w-[860px]">{props.children}</main>
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
