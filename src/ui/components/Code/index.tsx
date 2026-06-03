import { createEffect, createMemo, createSignal, onCleanup, Show } from 'solid-js'
// import { CodeJar } from 'codejar'
import { cn } from '@lickle/cn'

import { useMarkup, useCodeToHtml, type Highlighter } from '../../context/index.tsx'
import { isServer } from 'solid-js/web'

export const Code = (props: { code: string; lang?: string }) => {
  const html = useCodeToHtml({ ...props, structure: 'inline' })
  const visibility = createMemo(() => (html() ? 'opacity-100' : 'opacity-0'))
  const className = createMemo(() => cn('transition-opacity duration-200', visibility()))
  return (
    <code class={className()}>
      <Show when={html()} fallback={<pre class="h-12 w-full" />}>
        {(h) => <pre innerHTML={h()} />}
      </Show>
    </code>
  )
}

export const CodeBlock = (props: { code: string; lang?: string }) => (
  <div class="bg-code-bg border border-line rounded-lg p-4">
    <Code code={props.code} lang={props.lang} />
  </div>
)

type CodeEditorProps = {
  lang?: string
  readonly?: boolean
  value: () => string
  onChange?: (code: string) => void
}

export const CodeEditor = (props: CodeEditorProps) => {
  const editor = useCodeEditor(props)
  return <div ref={editor.onBind} spellcheck={false} />
}

type CodeJar = ReturnType<typeof import('codejar').CodeJar>

const useCodeEditor = (props: CodeEditorProps) => {
  const markup = useMarkup()
  let _jar: CodeJar | null = null
  let _host: HTMLElement | null = null
  let initialized = false
  let current = props.value()

  const [jar, setJar] = createSignal<CodeJar | null>(null)

  const setup = (host: HTMLElement, h: Highlighter) => {
    if (initialized && !isServer) return
    initialized = true
    import('codejar').then(({ CodeJar }) => {
      _jar = CodeJar(
        host,
        (el) => {
          try {
            el.innerHTML = h.codeToHtml({ text: el.textContent ?? '', lang: props.lang })
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
    })
  }

  const teardown = () => {
    _jar?.destroy()
    initialized = false
  }

  const init = () => {
    const h = markup.highlighter()
    const el = _host
    if (h && el) setup(el, h)
  }

  createEffect(init)

  createEffect(() => {
    const v = props.value()
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
  return { onBind, jar }
}
