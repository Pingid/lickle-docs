import type { JSONOutput } from 'typedoc'
import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import { commentSummaryText } from '../components/Comment.js'
import { useTypedoc, useIndex } from '../context/index.js'
import { effectiveKind, labelOf } from '../util/kind.js'
import { Markdown } from '../components/Markdown.js'

const readmeSource = (parts?: JSONOutput.CommentDisplayPart[]): string => {
  if (!parts?.length) return ''
  return parts.map((p) => (p.kind === 'text' || p.kind === 'code' ? p.text : (p.text ?? ''))).join('')
}

export const Home = () => {
  const td = useTypedoc()
  const idx = useIndex()
  const readme = () => readmeSource(td.readme)

  return (
    <article>
      <Show
        when={readme()}
        fallback={
          <>
            <h1 class="text-4xl font-semibold tracking-tight mb-2">{td.name}</h1>
            <Show when={td.comment}>
              <Markdown source={readmeSource(td.comment?.summary)} />
            </Show>
            <h2 class="text-xl font-semibold mt-10 mb-4 pb-2 border-b border-line">Exports</h2>
            <ul class="space-y-2">
              <For each={idx.routables}>
                {(r) => (
                  <li class="flex items-baseline gap-3">
                    <span class="text-xs uppercase text-mute tracking-wider w-20">{labelOf(effectiveKind(r))}</span>
                    <A href={`/r/${idx.slugById.get(r.id)}`} class="font-mono font-medium hover:opacity-70">
                      {r.name}
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
