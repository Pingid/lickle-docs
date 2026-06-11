import { Show } from 'solid-js'
import cn from '@lickle/cn'

import { useRenderMarkdown } from '../hooks/index.ts'
import { staticComponent } from '../util/solid.tsx'

/**
 * Render markdown through the site pipeline: fenced code highlighted with
 * the configured languages, and backtick identifiers — `Foo` or `Foo.bar` —
 * auto-linked to their declaration pages when the name resolves.
 */
export const Markdown = staticComponent((props: { source: string; class?: string }) => {
  const html = useRenderMarkdown(props.source)
  return <Show when={html()}>{(h) => <div class={cn('markdown', props.class)} innerHTML={h()} />}</Show>
})

/** {@link Markdown} with tight spacing, for single-line contexts: tag captions, parameter descriptions, list summaries. */
export const MarkdownInline = staticComponent((props: { source?: string; class?: string }) => {
  const html = useRenderMarkdown(props.source ?? '')
  return <Show when={html()}>{(h) => <div class={cn('markdown-tight', props.class)} innerHTML={h()} />}</Show>
})
