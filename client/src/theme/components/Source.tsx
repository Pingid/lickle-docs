import { Show } from 'solid-js'
import type * as docs from '@lickle/docs'

/** Stock source-location renderer. Replaceable via `slots.source`. */
export const Source = (props: { sources?: docs.Source[] }) => (
  <Show when={props.sources?.[0]}>
    {(s) => (
      <div class="text-xs text-mute mt-2">
        <span class="font-mono">
          {s().file}:{s().line}
        </span>
      </div>
    )}
  </Show>
)
