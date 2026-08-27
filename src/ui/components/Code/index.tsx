import { createEffect, createMemo, createSignal, onCleanup, Show } from 'solid-js'
import { isServer } from 'solid-js/web'
import { cn } from '@lickle/cn'

import { useHighlighter, type CodeHighlighter } from '../../context/highlight/context.tsx'
import { useCodeHighlight } from '../../hooks/index.ts'

/**
 * Syntax-highlighted code, unstyled. Renders a plain escaped `<pre>` until
 * the highlighter from `LanguagesProvider` is ready, then swaps in the
 * highlighted markup. Use {@link CodeBlock} for the bordered presentation.
 *
 * @example preview
 * ```tsx
 * <Code lang="ts" code={`export const answer = 42`} />
 * ```
 */
export const Code = (props: { code: string; lang?: string; class?: string }) => {
  const html = useCodeHighlight(props.code, props.lang ?? 'text')
  return (
    <div
      class={props.class}
      innerHTML={html() ?? `<pre class="codeblock"><code>${escapeHtml(props.code)}</code></pre>`}
    />
  )
}

/**
 * {@link Code} in the standard bordered block, as used for `@example` and fenced markdown code.
 *
 * @example preview
 * ```tsx
 * <CodeBlock lang="bash" code={`npx ldocs build --static`} />
 * ```
 */
export const CodeBlock = (props: { code: string; lang?: string }) => (
  <div class="bg-code-bg border border-line rounded-lg p-4">
    <Code code={props.code} lang={props.lang} />
  </div>
)

/**
 * An editable, syntax-highlighted code area (CodeJar under the hood —
 * loaded lazily on the client; SSR renders static {@link Code}). Drives the
 * editing half of `LiveExample`.
 *
 * Pass an accessor for `value` and the editor follows the signal rather than
 * re-mounting on every keystroke; pass a plain string for a snippet nothing
 * else writes to.
 *
 * @example preview
 * ```tsx
 * const [code, setCode] = createSignal('const answer = 42')
 * return (
 *   <Stack gap={2}>
 *     <Panel tone="code" pad>
 *       <CodeEditor lang="ts" value={code} onChange={setCode} />
 *     </Panel>
 *     <span class="text-xs text-mute">{() => `${code().length} characters`}</span>
 *   </Stack>
 * )
 * ```
 */
export const CodeEditor = (props: CodeEditorProps) => {
  const editor = useCodeEditor(props)
  const showWhenReady = createMemo(() =>
    cn('row-span-full col-span-full', editor.ready() ? 'opacity-100' : 'opacity-0'),
  )
  return (
    <div class="grid grid-cols-1 grid-rows-1">
      <Show when={!editor.ready() || isServer}>
        <Code code={valueOf(props)} lang={props.lang} class="row-span-full col-span-full" />
      </Show>
      <Show when={!isServer}>
        <div ref={editor.onBind} spellcheck={false} class={showWhenReady()} />
      </Show>
    </div>
  )
}

export type CodeEditorProps = {
  /** Language for highlighting. Defaults to plain text. */
  lang?: string
  /** Disable editing; the code still renders through the editor styling. */
  readonly?: boolean
  /**
   * Current code. Pass an accessor and the editor follows it; pass a plain
   * string for a fixed snippet.
   */
  value: string | (() => string)
  /** Called with the full text after each edit. */
  onChange?: (code: string) => void
}

type CodeJar = ReturnType<typeof import('codejar').CodeJar>

const useCodeEditor = (props: CodeEditorProps) => {
  const [ready, setReady] = createSignal(false)
  const markup = useHighlighter()
  let _jar: CodeJar | null = null
  let _host: HTMLElement | null = null
  let initialized = false
  let current = valueOf(props)

  const [jar, setJar] = createSignal<CodeJar | null>(null)

  const setup = (host: HTMLElement, c: CodeHighlighter) => {
    if (initialized && !isServer) return
    initialized = true
    import('codejar').then(({ CodeJar }) => {
      _jar = CodeJar(
        host,
        (el) => {
          try {
            el.innerHTML = c.codeToHtml(el.textContent ?? '', { lang: props.lang ?? 'text' })
          } catch (err) {
            console.warn('[Editor] highlight failed', err)
          }
        },
        {
          preserveIdent: true,
          addClosing: true,
        },
      )

      _jar.updateCode(current)
      _jar.onUpdate(() => {
        current = host.innerText
        props.onChange?.(host.innerText)
      })
      if (props.readonly) host.contentEditable = 'false'
      setJar(_jar)
      setReady(true)
    })
  }

  const teardown = () => {
    _jar?.destroy()
    initialized = false
  }

  const init = () => {
    const el = _host
    const c = markup()
    if (c && el && !isServer) setup(el, c)
  }

  createEffect(init)

  createEffect(() => {
    const v = valueOf(props)
    const j = jar()
    if (j && current !== v) {
      j.updateCode(v)
      current = v
    }
  })

  onCleanup(() => {
    jar()?.destroy()
    initialized = false
  })

  const onBind = (h: HTMLElement | null) => {
    if (_host === h) return
    if (!h) {
      teardown()
      _host = null
      return
    }
    _host = h
    init()
  }
  return { onBind, jar, ready }
}

// --- Helpers for the components above ---

/** Read {@link CodeEditorProps.value} in either of its accepted forms. */
const valueOf = (props: CodeEditorProps): string => (typeof props.value === 'function' ? props.value() : props.value)

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
