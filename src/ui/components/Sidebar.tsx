import { createEffect, createMemo, createSignal } from 'solid-js'

import { createSlot, type Reflect } from '../context/index.tsx'
import { DocRouter, useProject } from '../hooks/index.ts'
import { A, useLocation } from '../context/router/index.tsx'

import { KindBadge, NavTree, findTreeTrail, type TreeGroup, type TreeNode } from '../primitives/index.ts'

/**
 * Navigation tree built from the router's sidebar: grouped entries with kind
 * badges, collapsible branches, and the branch on the active path open
 * automatically. Replaceable via the `sidebar` slot; `onNavigate` fires on link
 * clicks so a mobile drawer can close itself.
 *
 * The tree itself is {@link NavTree}, which takes plain nodes. Everything this
 * component adds is context: the router's sidebar, the project's kinds for the
 * badges, and the URL → active-trail resolution below.
 *
 * The preview is the real thing, reading the same router as the sidebar beside
 * it — the branch you are reading is already open in both.
 *
 * @example preview
 * ```tsx
 * <Sidebar class="max-h-80 overflow-y-auto block" />
 * ```
 *
 * @group chrome
 */
export const Sidebar = createSlot('sidebar', (props) => {
  const router = DocRouter.use()
  const project = useProject()
  const loc = useLocation()

  const toNode = (n: Node): TreeNode => {
    const id = n.kind === 'doc' ? n.id : undefined
    const kind = id !== undefined ? project()?.byId(id)?.kind : undefined
    return {
      key: nodeKey(n),
      label: nodeLabel(n),
      href: n.kind === 'folder' ? undefined : n.slug,
      // No placeholder when there's no kind: a markdown page's label starts
      // where a declaration's badge would, not indented past it.
      badge: kind ? <KindBadge kind={kind} class="text-[0.7rem]! w-3.5 shrink-0" /> : undefined,
      children: n.children.map(toGroup),
    }
  }
  const toGroup = (g: Reflect.GroupedItems<Node>): TreeGroup => ({ group: g.group, items: g.items.map(toNode) })

  const groups = createMemo<TreeGroup[]>(() => (router()?.sidebar ?? []).map(toGroup))

  // Resolve the active occurrence from the URL when it isn't already pinned by
  // a click. A missing match keeps the previous selection, so navigating to a
  // page outside the sidebar doesn't collapse the open branch.
  createEffect(() => {
    const path = loc.pathname
    if (selected()?.path === path) return
    const trail = findTreeTrail(groups(), (n) => n.href !== undefined && pathOf(n.href) === path)
    if (trail) setSelected({ trail, path })
  })

  // Pin the clicked occurrence eagerly so it wins over the URL-derived fallback.
  const onNavigate = (node: TreeNode, trail: string) => {
    if (node.href !== undefined) setSelected({ trail, path: pathOf(node.href) })
    props.onNavigate?.()
  }

  return (
    <aside class={`text-[0.8125rem] ${props.class ?? ''}`}>
      {/* `px-4.5` + each row's own `px-1.5` puts label text at 24px — the same
          inset as the header's project name, so the two columns line up. */}
      <nav class="pt-5 pb-10 px-4.5">
        <NavTree groups={groups()} active={selected()?.trail} onNavigate={onNavigate} link={A} />
      </nav>
    </aside>
  )
})

// --- Selection state and the node → tree-node mapping ---

type Node = Reflect.SidebarNode

/**
 * The unique node occurrence the reader is viewing, identified by its trail.
 * The same page can appear under several parents; the trail disambiguates which
 * occurrence is active so only that branch opens. Module-level so the desktop
 * sidebar and the mobile drawer agree.
 */
const [selected, setSelected] = createSignal<{ trail: string; path: string } | null>(null)

/** Stable per-node identity among its siblings: the slug for pages, `f:`-prefixed ref for folders. */
const nodeKey = (n: Node): string => (n.kind === 'folder' ? `f:${n.ref}` : n.slug)

/** Display label: doc nodes prefer the branch-contextual qualifier. */
const nodeLabel = (n: Node): string => (n.kind === 'doc' ? (n.display ?? n.label) : n.label)

/** Normalised app-absolute path of a node slug, for comparison with `location.pathname`. */
const pathOf = (slug: string) => `/${slug}`.replace(/\/+/g, '/')
