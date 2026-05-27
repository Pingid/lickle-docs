import { onMount, onCleanup, createEffect } from 'solid-js'
import { CodeJar } from 'codejar'

import { getHighlighter, langOf } from '../util/markdown.js'

export const Editor = (props: {
  code: string
  language?: string
  readonly?: boolean
  /** Fired on every text update (CodeJar `onUpdate`). Use for live previews. */
  onChange?: (code: string) => void
}) => {
  let ref!: HTMLDivElement
  let jar: ReturnType<typeof CodeJar> | null = null

  onMount(async () => {
    const h = await getHighlighter()
    // shiki throws on unregistered langs; fall back to `ts` for any unknown value
    const lang = (() => {
      const l = langOf(props.language)
      return l === 'text' ? 'ts' : l
    })()

    jar = CodeJar(ref, (el) => {
      try {
        el.innerHTML = h.codeToHtml(el.textContent ?? '', {
          lang,
          themes: { light: 'github-light', dark: 'github-dark' },
          defaultColor: false,
        })
      } catch (err) {
        console.warn('[Editor] highlight failed', err)
      }
    })
    jar.updateCode(props.code)
    if (props.onChange) jar.onUpdate(props.onChange)
    if (props.readonly) ref.contentEditable = 'false'
  })

  // Reflect external code changes (e.g. navigation between examples)
  createEffect(() => {
    if (jar && jar.toString() !== props.code) jar.updateCode(props.code)
  })

  onCleanup(() => jar?.destroy())

  return <div ref={ref} class="editor" spellcheck={false} />
}
