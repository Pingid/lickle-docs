import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { cn } from '@lickle/cn'

import { createSlot } from '../context/components.tsx'
import { useLocation } from '../util/router.tsx'

import { Header, MENU_TOGGLE_ID } from './Header.tsx'
import { SearchPalette } from './SearchPalette.tsx'
import { Sidebar } from './Sidebar.tsx'

const SIDEBAR_MIN = 160
const SIDEBAR_MAX = 480
const SIDEBAR_STORE_KEY = 'lickle-docs:sidebar-width'

/**
 * Page chrome around the content: sticky {@link Header}, responsive
 * {@link Sidebar} (a CSS-only drawer below the `lg` breakpoint), the search
 * palette (toggled with `⌘K` / `Ctrl K`) and the main content well.
 * Replaceable via the `layout` slot.
 * @group components
 */
export const Layout = createSlot('layout', (props) => {
  const [searchOpen, setSearchOpen] = createSignal(false)
  const [sidebarWidth, setSidebarWidth] = createSignal<number | null>(null)
  const loc = useLocation()
  let menuToggle: HTMLInputElement | undefined
  let grid: HTMLDivElement | undefined

  createEffect(() => {
    void loc.pathname
    if (menuToggle) menuToggle.checked = false
  })

  onMount(() => {
    const saved = Number(localStorage.getItem(SIDEBAR_STORE_KEY))
    if (saved) setSidebarWidth(saved)
  })

  /** Drag the divider to resize the desktop sidebar, clamped and persisted. */
  const startResize = (e: PointerEvent) => {
    e.preventDefault()
    const left = grid?.getBoundingClientRect().left ?? 0
    const onMove = (m: PointerEvent) => setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, m.clientX - left)))
    const onUp = () => {
      const w = sidebarWidth()
      if (w) localStorage.setItem(SIDEBAR_STORE_KEY, String(w))
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

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

      <div
        ref={grid}
        class="relative flex-1 grid grid-cols-1 lg:grid-cols-[var(--sidebar-width)_1fr] max-w-[1400px] w-full mx-auto"
        style={sidebarWidth() ? { '--sidebar-width': `${sidebarWidth()}px` } : undefined}
      >
        <input
          id={MENU_TOGGLE_ID}
          ref={menuToggle}
          type="checkbox"
          aria-label="Toggle navigation"
          class="peer sr-only"
        />

        <Sidebar
          class={cn(
            'hidden lg:block border-r border-line sticky top-(--header-height) self-start h-(--sidebar-height) overflow-y-auto',
          )}
        />

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onPointerDown={startResize}
          class="hidden lg:block absolute top-0 bottom-0 left-(--sidebar-width) z-30 -ml-1 w-2 cursor-col-resize group"
        >
          <span class="block mx-auto h-full w-px bg-transparent transition-colors group-hover:bg-fg/30" />
        </div>

        <label
          for={MENU_TOGGLE_ID}
          aria-label="Close navigation"
          class="lg:hidden fixed inset-0 z-40 bg-black/30 opacity-0 pointer-events-none transition-opacity duration-200 peer-checked:opacity-100 peer-checked:pointer-events-auto"
        />
        <aside
          class={cn(
            'lg:hidden fixed inset-y-0 left-0 z-50 w-(--sidebar-sm-width) bg-bg border-r border-line overflow-y-auto pt-14 -translate-x-full transition-transform duration-200 ease-out peer-checked:translate-x-0',
          )}
        >
          <Sidebar />
        </aside>

        <main class={cn('min-w-0 px-6 lg:px-12 pt-8 pb-20 max-w-(--content-max-width) wrap-break-word')}>
          {props.children}
        </main>
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
})
