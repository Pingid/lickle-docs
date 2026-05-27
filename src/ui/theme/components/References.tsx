import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import { labelOf } from '../../util/kind.js'
import { useReferences, type ReferenceRow } from '../../hooks/index.js'

export const References = (props: { id: number }) => {
  const rows = useReferences(() => props.id)

  return (
    <Show when={rows().length}>
      <section class="mt-10 lk-references">
        <h2 class="font-semibold text-xl mb-4 pb-2 border-b border-line">Used in</h2>
        <ul>
          <For each={rows()}>{(r) => <ReferenceRowView row={r} />}</For>
        </ul>
      </section>
    </Show>
  )
}

const ReferenceRowView = (props: { row: ReferenceRow }) => (
  <li>
    <span class="kind">{labelOf(props.row.decl.kind)}</span>
    <A href={`/r/${props.row.slug}`} class="symbol font-mono hover:opacity-70">
      <Show when={props.row.module}>
        <span class="text-mute">{props.row.module}.</span>
      </Show>
      <span class="font-medium">{props.row.name}</span>
    </A>
    <span class="summary">{props.row.summary}</span>
  </li>
)
