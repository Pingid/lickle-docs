import { createMemo } from 'solid-js'

import { Crumbs, type Crumb } from '../primitives/index.ts'
import { DocRouter } from '../hooks/index.ts'
import { A } from '../context/router/index.tsx'

/**
 * Ancestor trail for a declaration — `project / module / namespace / name` —
 * with each resolvable segment linked.
 *
 * This is {@link Crumbs} with the segments looked up in the router. Pass
 * `items` instead of `id` to supply them yourself, which is also what makes
 * the trail renderable outside a docs route.
 *
 * @example preview
 * ```tsx
 * <Breadcrumb items={[{ label: '@lickle/docs', href: '#' }, { label: 'ui', href: '#' }, { label: 'Breadcrumb' }]} />
 * ```
 *
 * @group chrome
 */
export const Breadcrumb = (props: { id?: number; items?: Crumb[]; class?: string }) => {
  const router = DocRouter.use()
  const crumbs = createMemo<Crumb[]>(() => {
    if (props.items) return props.items
    if (props.id == null) return []
    return (router()?.parts(props.id) ?? []).map((part) => ({ label: part.value, href: part.slug }))
  })

  return <Crumbs items={crumbs()} link={A} class={props.class ?? 'mb-3'} />
}
