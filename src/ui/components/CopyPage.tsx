import { createMemo, createSignal, onCleanup, Show } from 'solid-js'

import { useProject, type Types } from '../context/index.tsx'
import { useSlugFor } from '../hooks/index.ts'
import { routeToMarkdown } from '../util/markdown.ts'
import { docStatement } from '../util/route.ts'
import { clientOnly } from '../util/solid.tsx'

const COPY = 'M9 9h10v10H9zM5 15H4V5h10v1'
const CHECK = 'm5 12 5 5 9-9'

/**
 * Copies the current page's main content to the clipboard as markdown. On
 * module/namespace pages (which have members) it opens a small menu offering
 * to inline every member's documentation; elsewhere it copies on click.
 */
export const CopyPageButton = clientOnly(() => (props: { route: Types.Route; class?: string }) => {
  const project = useProject()
  const slugs = useSlugFor()
  const [copied, setCopied] = createSignal(false)
  const [open, setOpen] = createSignal(false)

  const hasMembers = createMemo(() => {
    const stmt = docStatement(props.route)
    return !!stmt && project().routes.members(stmt.id).length > 0
  })

  const copy = (inlineMembers: boolean) => {
    const md = routeToMarkdown(props.route, project(), (name) => slugs.byName(name), { inlineMembers })
    void navigator.clipboard?.writeText(md).catch(() => {})
    setOpen(false)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const onClick = () => (hasMembers() ? setOpen((v) => !v) : copy(false))

  let root: HTMLDivElement | undefined
  const onDocClick = (e: MouseEvent) => {
    if (open() && root && !root.contains(e.target as Node)) setOpen(false)
  }
  document.addEventListener('click', onDocClick)
  onCleanup(() => document.removeEventListener('click', onDocClick))

  return (
    <div ref={root} class={`relative inline-flex ${props.class ?? ''}`}>
      <button
        type="button"
        onClick={onClick}
        aria-label="Copy page as markdown"
        aria-haspopup={hasMembers() ? 'menu' : undefined}
        title={copied() ? 'Copied' : 'Copy as markdown'}
        class="p-1.5 rounded-md text-mute hover:text-fg hover:bg-hover transition-colors cursor-pointer"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d={copied() ? CHECK : COPY} />
        </svg>
      </button>

      <Show when={open()}>
        <div
          role="menu"
          class="absolute right-0 mt-1 z-40 min-w-44 py-1 text-sm bg-bg border border-line rounded-md shadow-lg"
        >
          <MenuItem onClick={() => copy(false)}>Copy page</MenuItem>
          <MenuItem onClick={() => copy(true)}>Copy with members</MenuItem>
        </div>
      </Show>
    </div>
  )
})

const MenuItem = (props: { onClick: () => void; children: string }) => (
  <button
    type="button"
    role="menuitem"
    onClick={props.onClick}
    class="block w-full text-left px-3 py-1.5 text-mute hover:text-fg hover:bg-hover cursor-pointer"
  >
    {props.children}
  </button>
)
