import { transform as sucraseTransform, type Transform } from 'sucrase'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'

import type { Reflect } from '../../context/index.tsx'

import { Sandbox, type SandboxIsolate } from './Sandbox.tsx'

import { TagSection } from '../Comment/index.tsx'
import { CodeEditor } from '../Code/index.tsx'

type ExampleTag = Reflect.CommentTag<'@example'>

/** Executes already-compiled JS into the host; return a disposer to tear down. */
export type ExampleRun = (src: string, host: HTMLElement) => void | (() => void)

export type LiveExampleProps = {
  /** The `@example` tag to render: its code seeds the editor, its caption becomes the section description. */
  tag: ExampleTag
  /** Executes the compiled code into the preview host. Return a disposer to clean up before the next run. */
  run: ExampleRun
  /** Compiles editor source to runnable JS. A function, or {@link TransformOptions} for the built-in sucrase pass (`{}` for the defaults). Unset means run the source as-is. */
  transform?: Transformer
  /** Editor highlighting language. Defaults to the example's fence language. */
  language?: string
  /** Isolation strategy for the preview container. Only `'inline'` ships today. */
  isolate?: SandboxIsolate
  /** Disable editing. */
  readonly?: boolean
  /** Called when compiling or running throws. Errors render in the preview area either way. */
  onError?: (err: unknown) => void
}

/**
 * An editable, runnable rendering of an `@example` block: a {@link CodeEditor}
 * over the example's code with a live preview beneath. Every edit tears down
 * the previous run and re-executes; thrown errors render over the preview.
 *
 * Execution is yours to define — `transform` compiles the snippet and `run`
 * evaluates it against the preview element, so any framework (or none) can
 * back the examples. Wire it into the `tag` slot with `defineComponents` to
 * upgrade every `@example` in the project.
 *
 * @example Run examples as plain scripts with a `host` element in scope
 * ```tsx
 * import { defineComponents, LiveExample } from '@lickle/docs/ui'
 *
 * const run = (code: string, host: HTMLElement) => new Function('host', code)(host)
 *
 * export default defineComponents({
 *   tag: (props) =>
 *     props.tag.tag === '@example' ? (
 *       <LiveExample tag={props.tag} run={run} transform={{}} />
 *     ) : (
 *       <props.Default {...props} />
 *     ),
 * })
 * ```
 */
export const LiveExample = (props: LiveExampleProps) => {
  const preview = useWithPreview(props)

  return (
    <TagSection tag={props.tag} description={props.tag.caption}>
      <div class="rounded-lg border border-line">
        <div class="p-4 bg-code-bg">
          <CodeEditor
            lang={props.language ?? preview.lang}
            readonly={props.readonly}
            value={preview.value}
            onChange={preview.onChange}
          />
        </div>
        <div class="relative min-h-12">
          <Sandbox class="border-t border-line p-4" isolate={props.isolate} ref={preview.onBind} />
          <Show when={preview.error()}>
            {(msg) => (
              <div class="absolute inset-0 w-full h-full flex items-center justify-start p-4 text-xs text-red-500 border-t border-red-500/30 ">
                <div class="flex gap-2">
                  <span aria-hidden="true" class="select-none leading-5">
                    ⚠
                  </span>
                  <pre class="overflow-x-auto whitespace-pre-wrap wrap-break-word font-mono leading-5">{msg()}</pre>
                </div>
              </div>
            )}
          </Show>
        </div>
      </div>
    </TagSection>
  )
}

const useWithPreview = (props: LiveExampleProps) => {
  const [host, setHost] = createSignal<HTMLElement | null>(null)
  const [code, setCode] = createSignal(props.tag.code)
  const [error, setError] = createSignal<string>()

  let dispose: void | (() => void)
  const teardown = () => {
    try {
      if (typeof dispose === 'function') dispose()
      host()?.replaceChildren()
    } catch (err) {
      console.error('[LiveExample] teardown failed', err)
    }
    dispose = undefined
  }

  createEffect(() => {
    const src = code()
    const target = host()
    if (!target) return
    teardown()
    try {
      const transformed = getTransformer(props)(src)
      dispose = props.run(transformed, target)
      setError(undefined)
    } catch (err) {
      target.replaceChildren()
      setError(messageOf(err))
      if (props.onError) props.onError(err)
      else console.error('[LiveExample] failed to run', err)
    }
  })
  onCleanup(teardown)

  const onChange = (code: string) => setCode(code)

  const value = () => code()
  const onBind = (h: HTMLElement | null) => setHost(h)

  return { onBind, onChange, value, error, lang: props.tag.lang }
}

const messageOf = (err: unknown): string => {
  if (err instanceof Error) return err.message || err.name
  return String(err)
}

const getTransformer = (props: LiveExampleProps) => {
  const t = props.transform
  if (!t) return (src: string) => src
  if (typeof t === 'function') return t
  return (src: string) => transform(src, t)
}

export type Transformer = ((src: string) => string) | TransformOptions

export type TransformOptions = {
  /** Pre-transform hook. */
  pre?: (src: string) => string
  /** Sucrase transforms to apply. Default `['typescript', 'jsx']`. */
  transforms?: Transform[]
  /** JSX factory, e.g. `'h'`. Left to sucrase's default when unset. */
  jsxPragma?: string
  /** JSX fragment factory, e.g. `'Fragment'`. */
  jsxFragmentPragma?: string
  /** Production JSX output (no `__source`/`__self`). Default `true`. */
  production?: boolean
}

/**
 * Transform a TS/JSX snippet into runnable JS. Framework-agnostic: point
 * `jsxPragma` / `jsxFragmentPragma` at whatever runtime you inject when
 * executing the result.
 */
const transform = (src: string, options: TransformOptions = {}): string => {
  const code = options.pre?.(src) ?? src
  return sucraseTransform(code, {
    transforms: options.transforms ?? ['typescript', 'jsx'],
    jsxPragma: options.jsxPragma,
    jsxFragmentPragma: options.jsxFragmentPragma,
    production: options.production ?? true,
  }).code
}
