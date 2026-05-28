import { createResource, Show } from 'solid-js'

import { renderMarkdown, renderMarkdownSync, type CodespanLookup } from '../util/markdown.ts'
import { useSlugFor } from '../hooks/index.ts'

export const Markdown = (props: { source: string; class?: string }) => {
  const slugs = useSlugFor()
  const lookup: CodespanLookup = (raw) => slugs.byName(raw)
  const [html] = createResource(
    () => props.source,
    (s) => renderMarkdown(s, lookup),
  )
  return (
    <Show
      when={html()}
      fallback={<div class={`markdown ${props.class ?? ''}`} innerHTML={renderMarkdownSync(props.source, lookup)} />}
    >
      {(h) => <div class={`markdown ${props.class ?? ''}`} innerHTML={h()} />}
    </Show>
  )
}

Markdown.Inline = (props: { source?: string; class?: string }) => (
  <Show when={props.source}>
    {(source) => <Markdown class={`lk-md-inline ${props.class ?? ''}`} source={source()} />}
  </Show>
)
