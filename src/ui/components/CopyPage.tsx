import { createEffect, createMemo, createSignal, onCleanup, Show } from 'solid-js'

import { DocRouter, useProject, useSlugFor } from '../hooks/index.ts'
import { routeToMarkdown } from '../util/markdown.ts'
import { clientOnly } from '../util/solid.tsx'

const COPY = 'M9 9h10v10H9zM5 15H4V5h10v1'
const CHECK = 'm5 12 5 5 9-9'

/**
 * Copies the current page's main content to the clipboard as markdown. On
 * module/namespace pages (which have members) it opens a small menu offering
 * to inline every member's documentation; elsewhere it copies on click.
 */
export const CopyPageButton = clientOnly(() => (props: { route: DocRouter.PageNode; class?: string }) => {
  const router = DocRouter.use()
  const project = useProject()
  const slugs = useSlugFor()
  const [copied, setCopied] = createSignal(false)
  const [open, setOpen] = createSignal(false)

  const hasMembers = createMemo(() => props.route.kind === 'doc' && props.route.links.length > 0)

  let resetTimer: ReturnType<typeof setTimeout> | undefined
  const copy = (inlineMembers: boolean) => {
    const r = router()
    const p = project()
    if (!r || !p) return
    const md = routeToMarkdown(r, props.route, p, (name) => slugs.byName(name), { inlineMembers })
    void navigator.clipboard?.writeText(md).catch(() => {})
    setOpen(false)
    setCopied(true)
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => setCopied(false), 1500)
  }
  onCleanup(() => clearTimeout(resetTimer))

  const onClick = () => (hasMembers() ? setOpen((v) => !v) : copy(false))

  // Only listen for outside clicks while the menu is open; the effect re-runs
  // and tears down its listener whenever `open()` flips.
  let root: HTMLDivElement | undefined
  createEffect(() => {
    if (!open()) return
    const onDocClick = (e: MouseEvent) => {
      if (root && !root.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    onCleanup(() => document.removeEventListener('click', onDocClick))
  })

  return (
    <div
      ref={root}
      class={`relative inline-flex ${props.class ?? ''}`}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label="Copy page as markdown"
        aria-haspopup={hasMembers() ? 'menu' : undefined}
        aria-expanded={hasMembers() ? open() : undefined}
        title={copied() ? 'Copied' : 'Copy as markdown'}
        class="p-1.5 rounded-md text-mute hover:text-fg hover:bg-hover transition-colors cursor-pointer"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
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
