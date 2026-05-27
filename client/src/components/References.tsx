import { For, Show, createMemo } from 'solid-js'
import type * as docs from '@lickle/docs'
import { A } from '@solidjs/router'

import { effectiveKind, isRoutable, labelOf } from '../util/kind.js'
import { commentSummaryText } from './Comment.js'
import { useProject } from '../context/index.js'

type Row = {
  decl: docs.Declaration
  slug: string
  /** Everything before the final dot of the qualified name. Empty for top-level symbols. */
  module: string
  name: string
  qualified: string
  summary: string
}

/**
 * Climb `$.module` until we hit a routable declaration. The reference's
 * enclosing decl is usually that already, but for references that bubble up
 * through type-aliases or method bodies we may need an extra step.
 */
const routableAncestor = (decl: docs.Declaration): docs.Declaration | undefined => {
  let cur: docs.Declaration | undefined = decl
  while (cur) {
    if (isRoutable(cur.kind)) return cur
    cur = (cur as { $?: { module?: docs.Module } }).$?.module
  }
  return undefined
}

export const References = (props: { id: number }) => {
  const { project, slugById, qualifiedNameById } = useProject()

  const rows = createMemo<Row[]>(() => {
    const target = project.declarationsById.get(props.id)
    if (!target) return []
    const queries = (target as { $?: { referencedBy?: () => Iterable<docs.Reference> } }).$
    if (!queries?.referencedBy) return []

    const seen = new Set<number>()
    const out: Row[] = []
    for (const ref of queries.referencedBy()) {
      const ancestor = routableAncestor(ref.$.enclosingDeclaration)
      if (!ancestor || ancestor.id === props.id) continue
      if (seen.has(ancestor.id)) continue
      seen.add(ancestor.id)
      const slug = slugById.get(ancestor.id)
      if (!slug) continue
      const name = (ancestor as { name?: string }).name ?? ''
      const qualified = qualifiedNameById.get(ancestor.id) ?? name
      const dot = qualified.lastIndexOf('.')
      out.push({
        decl: ancestor,
        slug,
        module: dot < 0 ? '' : qualified.slice(0, dot),
        name: dot < 0 ? qualified : qualified.slice(dot + 1),
        qualified,
        summary: commentSummaryText(ancestor.comment),
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
