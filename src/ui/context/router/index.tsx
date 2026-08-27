import { createContext, useContext, type JSX } from 'solid-js'

import { A as AA, type AnchorProps } from '@solidjs/router'

export { Route, useParams, Navigate, HashRouter, useLocation, useNavigate } from '@solidjs/router'

export const A = (props: AnchorProps) => <AA {...props} {...useLinkMap().map(props)} />
/**
 * Apply a link mapping to every primitive below. Nesting replaces rather than
 * composes; pass a `map` that calls the outer one if you want both.
 */
export const LinkMapProvider = (props: { value?: LinkMap; children: JSX.Element }) => (
  <LinkMapCtx.Provider value={props.value ?? identity()}>{props.children}</LinkMapCtx.Provider>
)

/**
 * The active link mapping, or the identity mapping when none is provided.
 * @group hooks
 */
export const useLinkMap = (): LinkMap => useContext(LinkMapCtx)

/**
 * Rewrites a link on its way to the DOM — prefixing a base URL, marking
 * off-site destinations, versioning a slug.
 */
export type LinkMap = { map: (link: LinkTarget) => LinkTarget }

/**
 * A link as the primitives hand it over, before any site-level rewriting. The
 * handler travels with the target so a mapping can intercept the click too —
 * that's how a router takes over navigation without the primitive knowing.
 */
export interface LinkTarget extends AnchorProps {
  href: string
}

// --- The context itself, and what it falls back to ---

const LinkMapCtx = createContext<LinkMap>(identity())

/**
 * The identity mapping. It is the context *default*, not a fallback the
 * provider has to supply: `PlainLink` resolves `useLinkMap()` with no provider
 * above it and gets this, which is what keeps the navigation primitives
 * renderable outside the site — in a preview, a test, an embedding app.
 *
 * A `function` declaration so it can be hoisted past `LinkMapCtx`, which
 * consumes it at module-evaluation time.
 */
function identity(): LinkMap {
  return { map: (link) => link }
}
