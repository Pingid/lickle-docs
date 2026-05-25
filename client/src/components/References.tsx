import { For, Show, createMemo } from 'solid-js'
import type { JSONOutput } from 'typedoc'
import { A } from '@solidjs/router'

import { effectiveKind, labelOf } from '../util/kind.js'
import type { Reference } from '../util/references.js'
import { commentSummaryText } from './Comment.js'
import { useIndex } from '../context/index.js'

type Row = {
  ref: Reference
  decl: JSONOutput.DeclarationReflection
  slug: string
  /** Everything before the final dot of the qualified name. Empty for top-level symbols. */
  module: string
  name: string
  qualified: string
  summary: string
}

export const References = (props: { id: number }) => {
  const idx = useIndex()

  const rows = createMemo<Row[]>(() => {
    const list = idx.references.get(props.id) ?? []
    const out: Row[] = []
    for (const ref of list) {
      const slug = idx.slugById.get(ref.referrer)
      const decl = idx.byId.get(ref.referrer) as JSONOutput.DeclarationReflection | undefined
      if (!slug || !decl) continue
      const qualified = idx.qualifiedNameById.get(ref.referrer) ?? decl.name
      const dot = qualified.lastIndexOf('.')
      out.push({
        ref,
        decl,
        slug,
        module: dot < 0 ? '' : qualified.slice(0, dot),
        name: dot < 0 ? qualified : qualified.slice(dot + 1),
        qualified,
        summary: commentSummaryText(decl.comment),
      })
    }
    return out.sort((a, b) => a.qualified.localeCompare(b.qualified))
  })

  return (
    <Show when={rows().length}>
      <section class="mt-10 lk-references">
        <h2 class="font-semibold text-xl mb-4 pb-2 border-b border-line">Used in</h2>
        <ul>
          <For each={rows()}>{(r) => <ReferenceRow row={r} />}</For>
        </ul>
      </section>
    </Show>
  )
}

const ReferenceRow = (props: { row: Row }) => {
  return (
    <li>
      <span class="kind">{labelOf(effectiveKind(props.row.decl))}</span>
      <A href={`/r/${props.row.slug}`} class="symbol font-mono hover:opacity-70">
        <Show when={props.row.module}>
          <span class="text-mute">{props.row.module}.</span>
        </Show>
        <span class="font-medium">{props.row.name}</span>
      </A>
      <span class="summary">{props.row.summary}</span>
    </li>
  )
}
