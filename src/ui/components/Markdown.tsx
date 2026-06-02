import { createMemo, Show } from 'solid-js'

import { useMarkup } from '../context/index.ts'

export const Markdown = (props: { source: string; class?: string }) => {
  const markup = useMarkup()
  const html = createMemo(() => markup.marked()?.parse(props.source, { async: false }))
  return <Show when={html()}>{(h) => <div class={`markdown ${props.class ?? ''}`} innerHTML={h()} />}</Show>
}

Markdown.Inline = (props: { source?: string; class?: string }) => (
  <Show when={props.source}>
    {(source) => <Markdown class={`lk-md-inline ${props.class ?? ''}`} source={source()} />}
  </Show>
)
