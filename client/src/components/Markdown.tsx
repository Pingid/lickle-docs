import { createResource, Show } from 'solid-js'

import { renderMarkdown, renderMarkdownSync, type CodespanLookup } from '../util/markdown.js'
import { useProject } from '../context/index.js'

export const Markdown = (props: { source: string; class?: string }) => {
  const { slugByName } = useProject()
  const lookup: CodespanLookup = (raw) => slugByName.get(raw)
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
