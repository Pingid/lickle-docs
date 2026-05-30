import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import { createSlot, useProject } from '../context/index.ts'

export const Breadcrumb = createSlot('page.header.breadcrumb', (props: { id: number }) => {
  const project = useProject()
  const chain = () => project.ancestors(props.id)

  return (
    <nav class="text-xs text-mute mb-3" aria-label="Breadcrumb">
      <ol class="flex items-center gap-1.5 flex-wrap">
        <li>
          <A href="/" class="hover:text-fg">
            {project.name}
          </A>
        </li>
        <For each={chain()}>
          {(r, i) => {
            const isLast = i() === chain().length - 1
            return (
              <>
                <li class="text-mute opacity-60">/</li>
                <li>
                  <Show when={r.slug && !isLast} fallback={<span class="text-fg">{r.label}</span>}>
                    <A href={`/${r.slug}`} class="hover:text-fg">
                      {r.label}
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
})
