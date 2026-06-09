import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  useContext,
} from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import { isServer } from 'solid-js/web'

import { createHighlighterCore, type LanguageInput } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import githubLight from 'shiki/dist/themes/github-light.mjs'
import githubDark from 'shiki/dist/themes/github-dark.mjs'

export type CodeHighlighter = {
  available: Set<string>
  codeToHtml: (text: string, options: { lang: string }) => string
}

export type Lang = { name: string; import: LanguageInput }
export type Core = Awaited<ReturnType<typeof createHighlighterCore>>

// The live highlighter exposes a `codeToHtml` function that cannot be
// serialized into the SSR hydration payload, so it lives in a signal rather
// than a resource value. The resource only exists to make `renderToStringAsync`
// await the server-side build; the client rebuilds via an effect.
const HighlightingContext = createContext<Accessor<CodeHighlighter | undefined>>()

let cached: { key: string; core: Promise<Core> } | undefined

/**
 * Build a Shiki core for the given languages, memoized by language set. Shiki
 * is meant to be a singleton, so reuse the instance across SSR renders and
 * pre-build it (see `renderPage`) so the server can highlight synchronously.
 */
export const loadHighlighter = (langs: Lang[]): Promise<Core> => {
  const key = langs.map((l) => l.name).join(',')
  if (cached?.key !== key) {
    const core = createHighlighterCore({
      engine: createOnigurumaEngine(() => import('shiki/wasm')),
      themes: [githubDark, githubLight],
      langs: langs.map((l) => l.import),
    })
    cached = { key, core }
  }
  return cached.core
}

export function LanguagesProvider(props: { langs: Accessor<Lang[]>; highlighter?: Core; children: JSX.Element }) {
  const avaliable = createMemo<Set<string>>(() => new Set(props.langs().map((l) => l.name)))
  // Seed from a server-prebuilt instance so the SSR shell pass highlights.
  const [core, setCore] = createSignal<Core | undefined>(props.highlighter)

  // Server awaits the build (in case it wasn't seeded); no-op on the client.
  createResource(props.langs, async (langs) => {
    if (isServer && !core()) {
      const h = await loadHighlighter(langs)
      setCore(() => h)
    }
    return null
  })
  // Client builds after hydration (effects don't run during SSR).
  createEffect(() => {
    if (isServer) return
    void loadHighlighter(props.langs()).then((h) => setCore(() => h))
  })

  const value = createMemo<CodeHighlighter | undefined>(() => {
    const available = avaliable()
    const h = core()
    if (!h) return undefined
    return {
      available,
      codeToHtml: (text, options) =>
        h.codeToHtml(text, {
          themes: { light: 'github-light', dark: 'github-dark' },
          lang: langOf(options.lang, available),
        }),
    }
  })

  return <HighlightingContext.Provider value={value}>{props.children}</HighlightingContext.Provider>
}

export const useHighlighter = (): Accessor<CodeHighlighter | undefined> =>
  useContext(HighlightingContext) ?? (() => undefined)

// ---------------- LANGUAGE LOOKUP ----------------
const aliases: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  bash: 'shellscript',
}

const has = (info: string, available: Set<string>) => {
  if (available.has(info)) return info
  if (aliases[info] && available.has(aliases[info])) return aliases[info]
  return undefined
}

const langOf = (info: string | undefined, available: Set<string>) => {
  if (!info) return 'text'

  const matched = has(info, available)
  if (matched) return matched
  const base = info.slice(0, -1) || 'text'

  if (available.has(base)) {
    console.warn(`Missing language: ${info}x, using instead ${base}`)
    return base
  }

  console.warn(`Missing language: ${info}, using instead text, add '${info}' to the languages config`)
  return info ?? 'text'
}
