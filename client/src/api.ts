/**
 * Tag registry: the contract between the docs runtime and a consumer's
 * `docs/index.ts(x)`. The runner imports `onTag` and registers handlers at
 * module load time; the docs UI looks them up when rendering each
 * `comment.tags` entry.
 *
 * ```tsx
 * import { onTag } from '@lickle/toolbox/docs/client'
 * import { render } from 'solid-js/web'
 *
 * onTag('@runnable', (slot, code, ctx) => {
 *   new Function('host', code)(slot)
 * })
 * ```
 */
import type * as docs from '@lickle/docs'

export type TagPart = NonNullable<docs.Comment['parts']>[number]
export type Tag = docs.Comment['tags'][number]

export type TagContext = {
  /** The structured tag from the schema. */
  tag: Tag
  /** id of the reflection this tag is attached to. */
  reflectionId: number
  /** Leading text before the first fenced code block, trimmed. `''` when none. */
  title: string
  /** Fence language tag (e.g. `ts`, `tsx`). `''` when the tag has no fence. */
  language: string
  /** Raw markdown body of the tag (e.g. unknown tag `text`, or `@example` code body). */
  raw: string
}

/**
 * Mount UI into `slot` for one `@<tag>` block.
 *
 * - `slot` is an empty `<div>` owned by the caller; the handler may write into it freely.
 * - `code` is the body of the first fenced code block. If the tag has no fence,
 *   it falls back to the joined text of every content part (trimmed).
 * - Return a cleanup function if the handler holds resources (subscriptions, render disposers, etc.).
 */
export type TagHandler = (slot: HTMLDivElement, code: string, ctx: TagContext) => void | (() => void)

const handlers = new Map<string, TagHandler>()

const norm = (tag: string) => (tag.startsWith('@') ? tag : '@' + tag)

/** Register a handler for `@<tag>` block tags. Later calls replace earlier ones. */
export const onTag = (tag: string, handler: TagHandler): void => {
  handlers.set(norm(tag), handler)
}

/** Lookup a handler for `@<tag>`. Internal — used by the docs UI. */
export const handlerOf = (tag: string): TagHandler | undefined => handlers.get(norm(tag))

/** Drop a handler. */
export const offTag = (tag: string): void => {
  handlers.delete(norm(tag))
}
