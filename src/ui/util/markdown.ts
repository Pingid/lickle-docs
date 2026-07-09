/**
 * The markdown serializer lives in `core` — it turns core types (declarations,
 * routes) into markdown and has no UI dependencies. This shim keeps the UI's
 * import path stable and is where the client's base-URL policy is applied.
 */
export * from '../../core/markdown/index.ts'

import type { SlugOf } from '../../core/markdown/index.ts'
import { withBaseUrl } from './base.ts'

/** Wrap a slug resolver so `{@link}` hrefs are prefixed with the router base. */
export const clientSlugOf =
  (byName: (name: string) => string | undefined): SlugOf =>
  (name) => {
    const slug = byName(name)
    return slug === undefined ? undefined : withBaseUrl(slug)
  }
