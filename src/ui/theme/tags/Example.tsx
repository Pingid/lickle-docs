import { createEffect, createSignal, onCleanup, Show, type Component } from 'solid-js'

import type * as docs from '../../../core/client.ts'

import { Markdown } from '../../shared/Markdown.js'
import { Editor } from '../../shared/Editor.js'
import { TagSection } from './shared.js'

/** Wrap raw code in a default ```ts fence if it isn't already fenced. */
const ensureFenced = (code: string): string => (/^\s*```/.test(code) ? code : '```ts\n' + code + '\n```')

export const ExampleTag = (props: { tag: docs.CommentTagMap['@example'] }) => (
  <TagSection title="Example" description={props.tag.caption}>
    <Markdown source={ensureFenced(props.tag.code)} />
  </TagSection>
)

// ============================================================================
// RUNNABLE EXAMPLE
// ============================================================================

/**
 * Live `@example`: editor on top, debounced re-run into the sandbox below.
 * `execute` is the embedder's runtime — eval / iframe / worker / etc. — and
 * may return a cleanup callback that's invoked before each rerun and on
 * unmount. Errors thrown by `execute` are caught and rendered inline.
 *
 *     <ProjectProvider components={{ tags: { '@example': exampleRunnableTag(run) } }}>
 */
export const exampleRunnableTag =
  (execute: (slot: HTMLDivElement, code: string) => void | (() => void)): Component<{ tag: docs.CommentTag }> =>
  (props) => {
    const t = props.tag as docs.CommentTagMap['@example']
    const parsed = parseFenced(t.code)
    const original = parsed.content ?? ''
    const [code, setCode] = createSignal(original)
    const dirty = () => code() !== original
    return (
      <TagSection title="Example" description={t.caption}>
        <div class="lk-runnable">
          <Editor code={code()} onChange={setCode} language={parsed.language} />
          <div class="lk-runnable-bar">
            <span>Output</span>
            <Show when={dirty()}>
              <button
                type="button"
                class="lk-runnable-reset"
                onClick={() => setCode(original)}
                title="Revert to the original example"
              >
                <ResetIcon />
                <span>Reset</span>
              </button>
            </Show>
          </div>
          <Preview handler={execute} code={code} />
        </div>
      </TagSection>
    )
  }

const ResetIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
  </svg>
)

const fenceRegex = /^```([a-zA-Z0-9+-]+)?\r?\n([\s\S]*?)\r?\n```$/
const parseFenced = (text: string) => {
  const match = text.trim().match(fenceRegex)
  if (!match) return { language: '', content: text }
  return { language: match[1] ?? '', content: match[2] }
}

const RUN_DEBOUNCE_MS = 250

/**
 * Mount slot for runnable examples. Re-runs `handler` whenever `code()`
 * changes (debounced after the first run), tracks the handler's optional
 * cleanup, and surfaces thrown errors as an inline error block instead of
 * silently swapping the slot contents.
 */
export const Preview = (props: {
  handler: (slot: HTMLDivElement, code: string) => void | (() => void)
  code: () => string
}) => {
  let slot!: HTMLDivElement
  let cleanup: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let primed = false
  const [error, setError] = createSignal<string | undefined>(undefined)

  const teardown = () => {
    try {
      cleanup?.()
    } catch (err) {
      console.warn('[lickle-docs] preview cleanup threw', err)
    }
    cleanup = undefined
    slot.replaceChildren()
  }

  const exec = (code: string) => {
    teardown()
    try {
      const ret = props.handler(slot, code)
      cleanup = typeof ret === 'function' ? ret : undefined
      setError(undefined)
    } catch (err) {
      setError(err instanceof Error ? `${err.name}: ${err.message}` : String(err))
    }
  }

  createEffect(() => {
    const code = props.code()
    clearTimeout(timer)
    if (!primed) {
      primed = true
      exec(code)
    } else {
      timer = setTimeout(() => exec(code), RUN_DEBOUNCE_MS)
    }
  })

  onCleanup(() => {
    clearTimeout(timer)
    teardown()
  })

  return (
    <div class="lk-runnable-output" data-error={error() ? 'true' : undefined}>
      <div ref={slot} class="lk-runnable-slot" />
      <Show when={error()}>{(msg) => <div class="lk-runnable-error">{msg()}</div>}</Show>
    </div>
  )
}
