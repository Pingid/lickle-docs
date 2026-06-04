import { Show } from 'solid-js'
import cn from '@lickle/cn'

import { useRenderMarkdown } from '../context/index.tsx'

export const Markdown = (props: { source: string; class?: string }) => {
  const html = useRenderMarkdown(props.source)
  return <Show when={html()}>{(h) => <div class={cn('markdown', props.class)} innerHTML={h()} />}</Show>
}

Markdown.Inline = (props: { source?: string; class?: string }) => {
  const html = useRenderMarkdown(props.source ?? '')
  return <Show when={html()}>{(h) => <div class={cn('markdown-tight', props.class)} innerHTML={h()} />}</Show>
}
