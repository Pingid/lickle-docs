import { createContext, createSignal, onMount, useContext } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

/** Colour scheme preference. `'system'` follows the OS setting. */
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

/**
 * Theme state for the site. Persists the chosen {@link ThemeMode} to
 * `localStorage` and applies it as `data-theme` on `<html>`, which the
 * stylesheet (`@lickle/docs/theme.css`) keys its dark variants on. Required
 * by {@link useTheme}; `App` includes it.
 */
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

/**
 * Read and set the current theme.
 *
 * @returns `mode` (the stored preference) and `setMode`.
 * @throws When no {@link ThemeProvider} is mounted above the caller.
 * @group hooks
 */
export const useTheme = (): ThemeCtx => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>')
  return ctx
}
