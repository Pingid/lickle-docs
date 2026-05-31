import { Show, type Component } from 'solid-js'

import type * as docs from '../../../core/client.ts'

import { compile, firstCodeBlock, type CompileOptions } from './transform.ts'
import { type SandboxIsolate } from './Sandbox.tsx'
import { Runnable } from './Runnable.tsx'

type ExampleTag = docs.CommentTagMap['@example']

/** Executes already-compiled JS into the host; return a disposer to tear down. */
export type ExampleRun = (compiled: string, host: HTMLElement) => void | (() => void)

export type LiveExampleProps = {
  tag: ExampleTag
  /** Stock `@example` renderer, used for non-live examples. */
  Default: Component<{ tag: ExampleTag }>
  /** Inject your framework and run the compiled snippet. The only required piece. */
  run: ExampleRun
  /** Transform options (e.g. `jsxPragma`) for the built-in {@link compile}. */
  compile?: CompileOptions
  /** Decide which examples are live. Default: caption contains `live`. */
  live?: (tag: ExampleTag) => boolean
  language?: string
  isolate?: SandboxIsolate
  editable?: boolean
  onError?: (err: unknown) => void
}

const defaultLive = (tag: ExampleTag): boolean => /live/.test(tag.caption ?? '')

/**
 * Drop-in `tag.example` override that does the whole pipeline — detect a live
 * example, pull its first code block, transform it, and run it in a contained
 * host — so callers only provide `run`. Non-live examples fall through to the
 * stock renderer.
 *
 * @example
 * registerComponent('tag.example', (props) => <LiveExample {...props} run={run} />)
 */
export const LiveExample = (props: LiveExampleProps) => (
  <Show when={(props.live ?? defaultLive)(props.tag)} fallback={<props.Default tag={props.tag} />}>
    <Runnable
      code={firstCodeBlock(props.tag.code) ?? props.tag.code}
      run={(src, host) => props.run(compile(src, props.compile), host)}
      language={props.language ?? 'tsx'}
      isolate={props.isolate}
      editable={props.editable}
      onError={props.onError}
    />
  </Show>
)
