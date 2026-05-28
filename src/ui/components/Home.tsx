import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import { createSlot, useProject } from '../context/index.ts'
import { commentSummaryText } from '../util/comment.ts'
import { NavItem } from '../strategies/index.ts'

import { Markdown } from './Markdown.tsx'
import { Type } from './Type.tsx'

export const Home = createSlot('home', () => {
  const { project } = useProject()
  const readme = () => project.readme ?? ''

  return (
    <article>
      <Show when={readme()} fallback={<Surfaced />}>
        <Markdown source={readme()} />
      </Show>
    </article>
  )
})

const Surfaced = () => {
  const { surface, project } = useProject()
  return (
    <Show when={surface.length}>
      <h1 class="text-4xl font-semibold tracking-tight mb-2">{project.name}</h1>
      <h2 class="text-xl font-semibold mt-10 mb-4 pb-2 border-b border-line">Exports</h2>
      <ul class="space-y-2">
        <For each={surface}>{(it) => <SurfaceRow item={it} />}</For>
      </ul>
    </Show>
  )
}

const SurfaceRow = (props: { item: NavItem }) => (
  <li class="flex items-baseline gap-3">
    <Type.KindLabel kind={props.item.kind} class="w-20" />
    <A href={`/r/${props.item.slug}`} class="font-mono font-medium hover:opacity-70">
      {props.item.name}
    </A>
    <Show when={commentSummaryText(props.item.comment)}>
      <span class="text-sm text-mute truncate">{commentSummaryText(props.item.comment)}</span>
    </Show>
  </li>
)
