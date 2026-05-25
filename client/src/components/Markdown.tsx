import { createResource, Show } from 'solid-js'

import { renderMarkdown, renderMarkdownSync, type CodespanLookup } from '../util/markdown.js'
import { useIndex } from '../context/index.js'

export const Markdown = (props: { source: string; class?: string }) => {
  const idx = useIndex()
  const lookup: CodespanLookup = (raw) => idx.slugByName.get(raw)
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
