import { createContext, createSignal, onMount, useContext } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

export type ThemeMode = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'lickle-docs-theme'

type ThemeCtx = {
  mode: () => ThemeMode
  setMode: (m: ThemeMode) => void
}

const Ctx = createContext<ThemeCtx>()

const read = (): ThemeMode => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return 'system'
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

const apply = (m: ThemeMode) => {
  const el = document.documentElement
  if (m === 'system') delete el.dataset['theme']
  else el.dataset['theme'] = m
}

export const ThemeProvider = (props: { children: JSX.Element }) => {
  const [mode, set] = createSignal<ThemeMode>(read())

  onMount(() => apply(mode()))

  const setMode = (m: ThemeMode) => {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return
    if (m === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, m)
    set(m)
    apply(m)
  }

  return <Ctx.Provider value={{ mode, setMode }}>{props.children}</Ctx.Provider>
}

export const useTheme = (): ThemeCtx => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>')
  return ctx
}
