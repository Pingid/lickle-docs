import type { Component, JSX } from 'solid-js'
import { useLinkMap } from '../context/router/index.tsx'

/**
 * A bare `<a>` — the default for every primitive that renders a link.
 *
 * @group primitives
 */
export const PlainLink: LinkComponent = (props) => {
  const map = useLinkMap()
  // `state` is the router's navigation payload: meaningless on a bare `<a>`,
  // and its `unknown` type isn't assignable to the DOM attribute of that name.
  const attrs = () => {
    const { state: _state, ...rest } = map.map({ href: props.href, onClick: props.onClick })
    return { ...rest, class: props.class, classList: props.classList }
  }
  return <a {...attrs()}>{props.children}</a>
}

/**
 * The link element a navigation primitive renders.
 *
 * Primitives default to {@link PlainLink}, so `<Crumbs>` or `<NavTree>` render
 * with no router in scope — that's what makes them previewable. The site's
 * connected components pass the router's `A` instead, which is the only
 * difference between `<Crumbs>` and `<Breadcrumb>`.
 *
 * @group primitives
 */
export type LinkComponent = Component<{
  href: string
  class?: string
  classList?: Record<string, boolean | undefined>
  onClick?: (e: MouseEvent) => void
  children: JSX.Element
}>
