import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import { commentSummaryText } from '../util/comment.js'
import { useProject } from '../context/project.js'
import { KindLabel } from '../primitives/Kind.js'
import type { NavItem } from '../strategies/index.js'
import { Markdown } from '../shared/Markdown.js'

export const Home = () => {
  const { project, surface } = useProject()
  const readme = () => project.readme ?? ''

  return (
    <article>
      <Show when={readme()} fallback={<h1 class="text-4xl font-semibold tracking-tight mb-2">{project.name}</h1>}>
        <Markdown source={readme()} />
      </Show>
      <Show when={surface.length}>
        <h2 class="text-xl font-semibold mt-10 mb-4 pb-2 border-b border-line">Exports</h2>
        <ul class="space-y-2">
          <For each={surface}>{(it) => <SurfaceRow item={it} />}</For>
        </ul>
      </Show>
    </article>
  )
}

const SurfaceRow = (props: { item: NavItem }) => (
  <li class="flex items-baseline gap-3">
    <KindLabel kind={props.item.kind} class="w-20" />
    <A href={`/r/${props.item.slug}`} class="font-mono font-medium hover:opacity-70">
      {props.item.name}
    </A>
    <Show when={commentSummaryText(props.item.comment)}>
      <span class="text-sm text-mute truncate">{commentSummaryText(props.item.comment)}</span>
    </Show>
  </li>
)
