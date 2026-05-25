import { For, Show, createMemo } from 'solid-js'
import { A } from '@solidjs/router'

import { createSlot, useProject, type Types } from '../context/index.tsx'

type Crumb = { label: string; href?: string }

export const Breadcrumb = createSlot('page.header.breadcrumb', (props: { id: number }) => {
  const project = useProject()
  const crumbs = createMemo(() => buildCrumbs(project(), props.id))

  return (
    <nav class="text-xs text-mute mb-3" aria-label="Breadcrumb">
      <ol class="flex items-center gap-1.5 flex-wrap">
        <li>
          <A href="/" class="hover:text-fg">
            {project().name}
          </A>
        </li>
        <For each={crumbs()}>
          {(c, i) => (
            <>
              <li class="text-mute opacity-60">/</li>
              <li>
                <Show when={c.href && i() < crumbs().length - 1} fallback={<span class="text-fg">{c.label}</span>}>
                  <A href={c.href!} class="hover:text-fg">
                    {c.label}
                  </A>
                </Show>
              </li>
            </>
          )}
        </For>
      </ol>
    </nav>
  )
})

/**
 * One crumb per slug segment, so every module level is reachable — each prefix
 * resolves through `routeForSlug`, which returns pages even when they aren't in
 * the sidebar. Levels with no page render as plain text.
 */
const buildCrumbs = (project: Types.Project, id: number): Crumb[] => {
  const route = project.routeForId(id)
  if (!route?.slug) return []
  const segs = route.slug.split('/')
  return segs.map((seg, i) => {
    const prefix = segs.slice(0, i + 1).join('/')
    const r = project.routeForSlug(prefix)
    return { label: r?.label ?? seg, href: r ? `/${prefix}` : undefined }
  })
}
