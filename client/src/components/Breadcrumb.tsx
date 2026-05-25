import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import { ancestors } from '../util/reflection.js'
import { useIndex } from '../context/index.js'

export const Breadcrumb = (props: { id: number }) => {
  const idx = useIndex()
  const chain = () => ancestors(idx, props.id)

  return (
    <nav class="text-xs text-mute mb-3" aria-label="Breadcrumb">
      <ol class="flex items-center gap-1.5 flex-wrap">
        <li>
          <A href="/" class="hover:text-fg">
            {idx.project.name}
          </A>
        </li>
        <For each={chain().slice(1)}>
          {(r, i) => {
            const isLast = i() === chain().length - 2
            const slug = idx.slugById.get(r.id)
            return (
              <>
                <li class="text-mute opacity-60">/</li>
                <li>
                  <Show when={slug && !isLast} fallback={<span class="text-fg">{r.name}</span>}>
                    <A href={`/r/${slug}`} class="hover:text-fg">
                      {r.name}
                    </A>
                  </Show>
                </li>
              </>
            )
          }}
        </For>
      </ol>
    </nav>
  )
}
