import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import { commentSummaryText } from '../components/Comment.js'
import { useProject } from '../context/index.js'
import { effectiveKind, labelOf } from '../util/kind.js'
import { Markdown } from '../components/Markdown.js'

export const Home = () => {
  const { project, meta, slugById, routables } = useProject()
  const readme = () => meta.readme ?? ''

  return (
    <article>
      <Show
        when={readme()}
        fallback={
          <>
            <h1 class="text-4xl font-semibold tracking-tight mb-2">{project.name}</h1>
            <Show when={project.comment}>
              <Markdown source={project.comment!.text} />
            </Show>
            <h2 class="text-xl font-semibold mt-10 mb-4 pb-2 border-b border-line">Exports</h2>
            <ul class="space-y-2">
              <For each={routables}>
                {(r) => (
                  <li class="flex items-baseline gap-3">
                    <span class="text-xs uppercase text-mute tracking-wider w-20">{labelOf(effectiveKind(r))}</span>
                    <A href={`/r/${slugById.get(r.id)}`} class="font-mono font-medium hover:opacity-70">
                      {(r as { name?: string }).name}
                    </A>
                    <Show when={commentSummaryText(r.comment)}>
                      <span class="text-sm text-mute truncate">{commentSummaryText(r.comment)}</span>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </>
        }
      >
        <Markdown source={readme()} />
      </Show>
    </article>
  )
}
