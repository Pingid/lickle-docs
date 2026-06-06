import { createSignal } from 'solid-js'

import { useProject, type Types } from '../context/index.tsx'
import { useSlugFor } from '../hooks/index.ts'
import { routeToMarkdown } from '../util/markdown.ts'
import { clientOnly } from '../util/solid.tsx'

const COPY = 'M9 9h10v10H9zM5 15H4V5h10v1'
const CHECK = 'm5 12 5 5 9-9'

/** Copies the current page's main content to the clipboard as markdown. */
export const CopyPageButton = clientOnly(() => (props: { route: Types.Route; class?: string }) => {
  const project = useProject()
  const slugs = useSlugFor()
  const [copied, setCopied] = createSignal(false)

  const copy = async () => {
    const md = routeToMarkdown(props.route, project(), (name) => slugs.byName(name))
    try {
      await navigator.clipboard.writeText(md)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy page as markdown"
      title={copied() ? 'Copied' : 'Copy as markdown'}
      class={`p-1.5 rounded-md text-mute hover:text-fg hover:bg-hover transition-colors cursor-pointer ${props.class ?? ''}`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d={copied() ? CHECK : COPY} />
      </svg>
    </button>
  )
})
