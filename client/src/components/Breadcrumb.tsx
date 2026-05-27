import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import { ancestors } from '../util/project.js'
import { useProject } from '../context/index.js'

export const Breadcrumb = (props: { id: number }) => {
  const { project } = useProject()
  const chain = () => ancestors(project, props.id)

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
            const slug = project.slugById.get(r.id)
            const name =
              (r as { displayName?: string }).displayName ??
              (r as { name?: string; path?: string }).name ??
              (r as { path?: string }).path ??
              ''
            return (
              <>
                <li class="text-mute opacity-60">/</li>
                <li>
                  <Show when={slug && !isLast} fallback={<span class="text-fg">{name}</span>}>
                    <A href={`/r/${slug}`} class="hover:text-fg">
                      {name}
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
