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

/** Resolve an app-absolute path (`/foo`) or asset name (`icons.svg`) against {@link BASE_URL}. */
export const withBaseUrl = (path: string): string => `${BASE_URL}/${path.replace(/^\/+/, '')}`

declare global {
  interface ImportMetaEnv {
    VITE_MANIFEST_PATH: string
  }
}
