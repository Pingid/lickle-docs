import { Show, createEffect, createSignal, onCleanup } from 'solid-js'

import { Editor } from '../Editor.tsx'
import { Sandbox, type SandboxIsolate } from './Sandbox.tsx'

/**
 * Executes `code` into `host`. Return a disposer to tear the example down
 * before the next run (e.g. unmount a component, stop effects).
 */
export type RunFn = (code: string, host: HTMLElement) => void | (() => void)

/**
 * A live example: a contained preview over an optional editor. The library
 * never assumes the example's framework — supply `run` to compile and mount
 * with whatever runtime you like. Errors thrown by `run` surface inline.
 */
export const Runnable = (props: {
  code: string
  run: RunFn
  language?: string
  /** Show the editor. Default `true`. */
  editable?: boolean
  isolate?: SandboxIsolate
  class?: string
  onError?: (err: unknown) => void
}) => {
  const [code, setCode] = createSignal(props.code)
  const [host, setHost] = createSignal<HTMLElement>()
  const [error, setError] = createSignal<string>()

  let dispose: void | (() => void)
  const teardown = () => {
    try {
      if (typeof dispose === 'function') dispose()
    } catch (err) {
      console.error('[Runnable] teardown failed', err)
    }
    dispose = undefined
  }

  createEffect(() => {
    const target = host()
    const src = code()
    if (!target) return
    teardown()
    try {
      dispose = props.run(src, target)
      setError(undefined)
    } catch (err) {
      console.log(err)
      target.replaceChildren()
      setError(messageOf(err))
      if (props.onError) props.onError(err)
      else console.error('[Runnable]', err)
    }
  })
  onCleanup(teardown)

  return (
    <div class={`lk-runnable not-prose my-5 overflow-hidden rounded-lg border border-line ${props.class ?? ''}`}>
      <div class="relative min-h-20 p-4">
        <Sandbox isolate={props.isolate} ref={setHost} />
      </div>
      <Show when={props.editable ?? true}>
        <div class="border-t border-line">
          <Editor code={props.code} language={props.language} onChange={setCode} />
        </div>
      </Show>
      <Show when={error()}>
        {(msg) => (
          <div class="flex gap-2 border-t border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-500">
            <span aria-hidden="true" class="select-none leading-5">
              ⚠
            </span>
            <pre class="overflow-x-auto whitespace-pre-wrap wrap-break-word font-mono leading-5">{msg()}</pre>
          </div>
        )}
      </Show>
    </div>
  )
}

const messageOf = (err: unknown): string => {
  if (err instanceof Error) return err.message || err.name
  return String(err)
}
