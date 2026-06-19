import { For, Show, createMemo } from 'solid-js'
import { A } from '../util/router.tsx'

import { DocRouter } from '../hooks/index.ts'

/** Ancestor trail for a declaration — `project / module / namespace / name` — with each resolvable segment linked. */
export const Breadcrumb = (props: { id: number }) => {
  const router = DocRouter.use()
  const crumbs = createMemo(() => router()?.parts(props.id))

  return (
    <nav class="text-xs text-mute mb-3" aria-label="Breadcrumb">
      <ol class="flex items-center gap-1.5 flex-wrap">
        <For each={crumbs()}>
          {(c, i) => (
            <>
              {i() > 0 && <li class="text-mute opacity-60">/</li>}
              <li>
                <Show when={c.slug} fallback={<span class="text-fg">{c.value}</span>}>
                  {(s) => (
                    <A href={s()} class="hover:text-fg">
                      {c.value}
                    </A>
                  )}
                </Show>
              </li>
            </>
          )}
        </For>
      </ol>
    </nav>
  )
}
