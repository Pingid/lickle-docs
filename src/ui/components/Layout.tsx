import { createSignal, onCleanup, onMount, Show, type Accessor } from 'solid-js'

import { createEffect } from 'solid-js'

import { createSlot } from '../context/components.tsx'
import { useLocation } from '../context/router.tsx'

import { Header, MENU_TOGGLE_ID } from './Header.tsx'
import { SearchPalette } from './SearchPalette.tsx'
import { useProject } from '../context/index.tsx'
import { Sidebar } from './Sidebar.tsx'
import { cn } from '@lickle/cn'

export const Layout = createSlot('layout', (props) => {
  const [searchOpen, setSearchOpen] = createSignal(false)
  const project = useProject()
  const loc = useLocation()
  let menuToggle: HTMLInputElement | undefined

  createEffect(() => {
    void loc.pathname
    if (menuToggle) menuToggle.checked = false
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
    <div class="flex flex-col w-full h-full">
      <Header onSearch={() => setSearchOpen(true)} />

      <div class="flex-1 grid grid-cols-1 lg:grid-cols-[var(--sidebar-width)_1fr] max-w-[1400px] w-full mx-auto">
        <input
          id={MENU_TOGGLE_ID}
          ref={menuToggle}
          type="checkbox"
          aria-label="Toggle navigation"
          class="peer sr-only"
        />

        <Sidebar
          class={cn(
            loadingFreeze(props.loading),
            'hidden lg:block border-r border-line sticky top-(--header-height) self-start h-(--sidebar-height) overflow-y-auto',
          )}
        />

        <label
          for={MENU_TOGGLE_ID}
          aria-label="Close navigation"
          class="lg:hidden fixed inset-0 z-40 bg-black/30 opacity-0 pointer-events-none transition-opacity duration-200 peer-checked:opacity-100 peer-checked:pointer-events-auto"
        />
        <aside
          class={cn(
            loadingFreeze(props.loading),
            'lg:hidden fixed inset-y-0 left-0 z-50 w-(--sidebar-sm-width) bg-bg border-r border-line overflow-y-auto pt-14 -translate-x-full transition-transform duration-200 ease-out peer-checked:translate-x-0',
          )}
        >
          <Sidebar />
        </aside>

        <main
          class={cn(
            loadingFreeze(props.loading),
            'min-w-0 px-6 lg:px-12 pt-8 pb-20 max-w-(--content-max-width) wrap-break-word',
          )}
        >
          {props.children}
        </main>
      </div>

      <Show when={project()}>
        {(project) => <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} project={project()} />}
      </Show>
    </div>
  )
})

const loadingFreeze = (loading: Accessor<boolean>, cls?: string) =>
  cn(cls, [loading(), 'animate-pulse pointer-events-none'])
