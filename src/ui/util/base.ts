/// <reference types="vite/client" />

/**
 * Base path the docs are served under, taken from Vite's `base` (exposed as
 * `import.meta.env.BASE_URL`). Normalised without a trailing slash, so `''`
 * means the site lives at the root.
 *
 * The router (`<Router base>`) already rewrites `<A>` hrefs and strips the
 * prefix from `useLocation().pathname`, so component links stay app-absolute
 * (`/slug`). Use {@link withBaseUrl} only for URLs that bypass the router: raw
 * HTML anchors and static assets.
 */
export const BASE_URL: string = import.meta.env.BASE_URL.replace(/\/+$/, '')

/**
 * Resolve an app-absolute path (`/foo`) or asset name (`icons.svg`) against {@link BASE_URL}.
 * @group utilities
 */
export const withBaseUrl = (path: string): string => `${BASE_URL}/${path.replace(/^\/+/, '')}`

/**
 * The inverse of {@link withBaseUrl}: drop the base prefix from a location
 * pathname, leaving the app-absolute path.
 *
 * `useLocation().pathname` reports the *browser's* path, base included — the
 * router strips the base for route matching but not here. Anything comparing a
 * pathname against an app-absolute value (a version slug, say) has to strip it
 * first, or it silently never matches once the site is served under a base.
 */
export const stripBaseUrl = (path: string): string => {
  if (!BASE_URL || !path.startsWith(BASE_URL)) return path
  const rest = path.slice(BASE_URL.length)
  return rest.startsWith('/') || rest === '' ? rest || '/' : path
}

declare global {
  interface ImportMetaEnv {
    VITE_MANIFEST_PATH: string
  }
}
