import { type Accessor, createContext, createEffect, createMemo, createSignal, useContext } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import { isServer } from 'solid-js/web'

import { createHighlighterCore, type LanguageInput } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import githubLight from 'shiki/dist/themes/github-light.mjs'
import githubDark from 'shiki/dist/themes/github-dark.mjs'

/** The highlighting surface components consume: the loaded language names and a `codeToHtml` renderer. */
export type CodeHighlighter = {
  available: Set<string>
  codeToHtml: (text: string, options: { lang: string }) => string
}

/** A loadable Shiki grammar: its name plus the grammar module to import. */
export type Lang = { name: string; import: LanguageInput }
/** The underlying Shiki highlighter instance. */
export type Core = Awaited<ReturnType<typeof createHighlighterCore>>

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

/**
 * Provide syntax highlighting for the given languages. All code rendering —
 * fenced markdown blocks, `@example` blocks, signatures, the live-example
 * editor — reads the highlighter from this context; without it, code renders
 * as plain text. The grammar set comes from the config's `languages` field.
 *
 * The highlighter is built on the client after hydration. For SSR, pass a
 * server-prebuilt `highlighter` (see {@link loadHighlighter}) so the first
 * paint is already highlighted.
 */
export function LanguagesProvider(props: { langs: Accessor<Lang[]>; highlighter?: Core; children: JSX.Element }) {
  const avaliable = createMemo<Set<string>>(() => new Set(props.langs().map((l) => l.name)))
  // Seed from a server-prebuilt instance so the SSR shell pass highlights.
  const [core, setCore] = createSignal<Core | undefined>(props.highlighter)

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

/**
 * Read the active highlighter.
 * @group hooks
 * */
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
