import type { Component } from 'solid-js'

import type * as docs from '../../core/client.ts'

import type { PageComponent, TagComponent } from './types.js'

/**
 * Pin a narrow tag type at the call site, broaden it for storage. Use with
 * `Object.fromEntries`:
 *
 *     const tags = Object.fromEntries([
 *       tag('@returns', MyReturnsTag),
 *       tag('@example', MyExampleTag),
 *     ])
 *
 * The component sees the precise `CommentTagMap[K]` shape; the registry
 * stores it under the broad `Component<{ tag: CommentTag; … }>` type so the
 * runtime dispatcher needs no casts.
 */
export const tag = <K extends keyof docs.CommentTagMap>(
  key: K,
  Component: Component<{ tag: docs.CommentTagMap[K]; decl?: docs.Declaration }>,
): [K, TagComponent] => [key, Component as unknown as TagComponent]

/**
 * Same trick as `tag`, but for page components. Lets `pages['class']` be
 * authored with the narrow `Declaration<'class'>` shape.
 */
export const page = <K extends docs.Declaration['kind']>(
  key: K,
  Component: Component<{ decl: docs.Declaration<K> }>,
): [K, PageComponent] => [key, Component as unknown as PageComponent]
