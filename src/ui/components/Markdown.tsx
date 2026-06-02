import { createMemo, Show } from 'solid-js'
import cn from '@lickle/cn'

import { useMarkup } from '../context/index.ts'

export const Markdown = (props: { source: string; class?: string }) => {
  const markup = useMarkup()
  const html = createMemo(() => markup.marked()?.parse(props.source, { async: false }))
  return <Show when={html()}>{(h) => <div class={cn('markdown', props.class)} innerHTML={h()} />}</Show>
}

Markdown.Inline = (props: { source?: string; class?: string }) => {
  const markup = useMarkup()
  const html = createMemo(() => markup.marked()?.parse(props.source ?? '', { async: false }))
  return <Show when={html()}>{(h) => <div class={cn('markdown-tight', props.class)} innerHTML={h()} />}</Show>
}
