import { Show } from 'solid-js'
import cn from '@lickle/cn'

import { useRenderMarkdown } from '../hooks/index.ts'
import { staticComponent } from '../util/solid.tsx'

export const Markdown = staticComponent((props: { source: string; class?: string }) => {
  const html = useRenderMarkdown(props.source)
  return <Show when={html()}>{(h) => <div class={cn('markdown', props.class)} innerHTML={h()} />}</Show>
})

export const MarkdownInline = staticComponent((props: { source?: string; class?: string }) => {
  const html = useRenderMarkdown(props.source ?? '')
  return <Show when={html()}>{(h) => <div class={cn('markdown-tight', props.class)} innerHTML={h()} />}</Show>
})
