import { createMemo, createSignal, onCleanup, Show } from 'solid-js'

import { DocRouter, useProject, useSlugFor } from '../hooks/index.ts'
import { routeToMarkdown, clientSlugOf } from '../util/markdown.ts'
import { clientOnly } from '../util/solid.tsx'

import { CheckIcon, CopyIcon, IconButton, Menu, MenuItem } from '../primitives/index.ts'

/**
 * Copies the current page's main content to the clipboard as markdown. On
 * module/namespace pages (which have members) it opens a small menu offering
 * to inline every member's documentation; elsewhere it copies on click.
 *
 * The button and the menu are {@link IconButton} and {@link Menu}; what this
 * component adds is the route → markdown pass over the project data.
 *
 * @example preview
 * ```tsx
 * <CopyPageButton route={useRoute()()!} />
 * ```
 *
 * @group chrome
 */
export const CopyPageButton = clientOnly(() => (props: { route: DocRouter.PageNode; class?: string }) => {
  const router = DocRouter.use()
  const project = useProject()
  const slugs = useSlugFor()
  const [copied, setCopied] = createSignal(false)

  const hasMembers = createMemo(() => props.route.kind === 'doc' && props.route.links.length > 0)

  let resetTimer: ReturnType<typeof setTimeout> | undefined
  const copy = (inlineMembers: boolean) => {
    const r = router()
    const p = project()
    if (!r || !p) return
    const md = routeToMarkdown(r, props.route, p, clientSlugOf((name) => slugs.byName(name)), { inlineMembers })
    void navigator.clipboard?.writeText(md).catch(() => {})
    setCopied(true)
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => setCopied(false), 1500)
  }
  onCleanup(() => clearTimeout(resetTimer))

  const Trigger = (p: { onClick?: () => void }) => (
    <IconButton label={copied() ? 'Copied' : 'Copy as markdown'} onClick={p.onClick}>
      <Show when={copied()} fallback={<CopyIcon size={15} />}>
        <CheckIcon size={15} />
      </Show>
    </IconButton>
  )

  return (
    <Show when={hasMembers()} fallback={<Trigger onClick={() => copy(false)} />}>
      <Menu class={props.class} trigger={(_open, toggle) => <Trigger onClick={toggle} />}>
        <MenuItem onClick={() => copy(false)}>Copy page</MenuItem>
        <MenuItem onClick={() => copy(true)}>Copy with members</MenuItem>
      </Menu>
    </Show>
  )
})
