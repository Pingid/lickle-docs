import { For, Show, createEffect, createSignal, on, type JSX } from 'solid-js'
import cn from '@lickle/cn'

import { PlainLink, type LinkComponent } from './link.tsx'
import { Caret } from './control.tsx'

/**
 * An ancestor trail. Takes its segments as data, so it renders anywhere —
 * `Breadcrumb` is this component plus a router lookup.
 *
 * @example preview
 * ```tsx
 * <Crumbs
 *   items={[
 *     { label: '@lickle/docs', href: '#' },
 *     { label: 'ui', href: '#' },
 *     { label: 'Crumbs' },
 *   ]}
 * />
 * ```
 *
 * @group primitives
 */
export const Crumbs = (props: {
  items: Crumb[]
  /** Separator glyph between segments. Defaults to `/`. */
  separator?: string
  /** Link element to render `href` segments with. Defaults to a bare `<a>`. */
  link?: LinkComponent
  class?: string
}) => {
  const Link = () => props.link ?? PlainLink
  return (
    <nav class={cn('text-xs text-mute', props.class)} aria-label="Breadcrumb">
      <ol class="flex items-center gap-1.5 flex-wrap">
        <For each={props.items}>
          {(crumb, i) => (
            <>
              <Show when={i() > 0}>
                <li aria-hidden="true" class="text-mute opacity-60">
                  {props.separator ?? '/'}
                </li>
              </Show>
              <li>
                <Show when={crumb.href} fallback={<span class="text-fg">{crumb.label}</span>}>
                  {(href) => {
                    const L = Link()
                    return (
                      <L href={href()} class="hover:text-fg">
                        {crumb.label}
                      </L>
                    )
                  }}
                </Show>
              </li>
            </>
          )}
        </For>
      </ol>
    </nav>
  )
}

/**
 * A collapsible navigation tree over plain data — the shape behind the site's
 * sidebar, minus the router.
 *
 * Branches open by trail, not by slug: pass the `active` trail (from
 * {@link findTreeTrail}) and exactly that branch expands, even when the same
 * page also appears somewhere else in the tree. The reader can still toggle
 * any branch by hand between navigations; the next `active` change re-syncs.
 *
 * @example preview
 * ```tsx
 * <Panel class="p-2 max-w-xs">
 *   <NavTree
 *     active=">api>layout"
 *     groups={[
 *       { group: 'Guides', items: [
 *         { key: 'config', label: 'Configuration', href: '#' },
 *         { key: 'recipes', label: 'Layout recipes', href: '#' },
 *       ]},
 *       { group: 'API', items: [
 *         { key: 'api', label: 'config', href: '#', badge: <KindBadge kind="module" />, children: [
 *           { items: [
 *             { key: 'layout', label: 'Layout', href: '#', badge: <KindBadge kind="type-alias" /> },
 *             { key: 'place', label: 'Place', href: '#', badge: <KindBadge kind="namespace" /> },
 *           ]},
 *         ]},
 *       ]},
 *     ]}
 *   />
 * </Panel>
 * ```
 *
 * @group primitives
 */
export const NavTree = (props: {
  groups: TreeGroup[]
  /** Trail of the node to highlight and reveal. See {@link findTreeTrail}. */
  active?: string
  /** Fired on link clicks — a mobile drawer closes itself here. */
  onNavigate?: (node: TreeNode, trail: string) => void
  /** Link element for nodes with an `href`. Defaults to a bare `<a>`. */
  link?: LinkComponent
  /** Recursion guard. Defaults to 10. */
  maxDepth?: number
  class?: string
}) => (
  <div class={cn('space-y-0.5', props.class)}>
    <NavGroups groups={props.groups} depth={0} trail="" ctx={props} />
  </div>
)

/**
 * Depth-first search for the trail of the first node satisfying `match`.
 *
 * A tree can list the same page under several parents, so a slug alone doesn't
 * identify an occurrence — the trail does. Feed the result back in as
 * {@link NavTree}'s `active` to open exactly the branch the reader came
 * through, and no other.
 *
 * @group primitives
 */
export const findTreeTrail = (
  groups: TreeGroup[],
  match: (node: TreeNode) => boolean,
  parent = '',
): string | undefined => {
  for (const group of groups)
    for (const node of group.items) {
      const trail = treeTrail(parent, node.key)
      if (match(node)) return trail
      const child = findTreeTrail(node.children ?? [], match, trail)
      if (child) return child
    }
  return undefined
}

/** The trail of a child, given its parent's trail. The root's trail is `''`. @group primitives */
export const treeTrail = (parent: string, key: string): string => `${parent}>${key}`

/**
 * One segment of a {@link Crumbs} trail. Without an `href` the segment renders
 * as plain text — the trailing segment usually is, and so is any ancestor with
 * no page of its own.
 *
 * @group primitives
 */
export type Crumb = { label: string; href?: string }

/**
 * A node in a {@link NavTree}. `key` only has to be unique among its siblings —
 * the tree combines it with its ancestors' keys to form a trail. A node with no
 * `href` is a folder: it renders as plain text and only toggles.
 *
 * @group primitives
 */
export type TreeNode = {
  key: string
  label: string
  href?: string
  /** Leading cue — a {@link KindBadge}, an icon, a dot. */
  badge?: JSX.Element
  children?: TreeGroup[]
}

/** A run of sibling {@link TreeNode}s under an optional heading. @group primitives */
export type TreeGroup = { group?: string; items: TreeNode[] }

// --- Internals of the tree: one level, one node, one row ---

type Ctx = Parameters<typeof NavTree>[0]

const NavGroups = (props: { groups: TreeGroup[]; depth: number; trail: string; ctx: Ctx }) => (
  <For each={props.groups}>
    {(group) => (
      <Show when={props.depth <= (props.ctx.maxDepth ?? 10)} fallback={null}>
        <div style={{ '--nav-depth': props.depth }}>
          <Show when={group.group}>
            {(label) => (
              <div class={cn('pr-2 pt-2 pb-1 text-[0.6875rem] font-medium text-mute/55 select-none first:pt-1', INDENT)}>
                {label()}
              </div>
            )}
          </Show>
          <For each={group.items}>
            {(node) => <NavItem node={node} depth={props.depth} trail={props.trail} ctx={props.ctx} />}
          </For>
        </div>
      </Show>
    )}
  </For>
)

/**
 * A branch is a controlled `<details>` rather than a native uncontrolled one:
 * every change of `active` has to re-sync it — opening the branch the reader
 * navigated into and collapsing the rest — which an uncontrolled `<details>`
 * gives no way to do. The chevron is a separate hit target because a
 * `<summary>` toggle swallows the router's delegated link clicks.
 */
const NavItem = (props: { node: TreeNode; depth: number; trail: string; ctx: Ctx }) => {
  const trail = () => treeTrail(props.trail, props.node.key)
  const isActive = () => props.ctx.active === trail()
  const onTrail = () => props.ctx.active === trail() || !!props.ctx.active?.startsWith(`${trail()}>`)

  const [open, setOpen] = createSignal(onTrail())
  createEffect(on(() => props.ctx.active, () => setOpen(onTrail())))

  return (
    <Show
      when={hasChildren(props.node)}
      fallback={
        // Deliberately not a flex row: the leaf sits flush at the indent, where
        // a branch is pushed across by its chevron. The label text lands at the
        // same 24px inset as the header's project name.
        <div class={INDENT}>
          <NavRow node={props.node} trail={trail()} active={isActive()} ctx={props.ctx} />
        </div>
      }
    >
      <details open={open()} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary
          class={cn(
            'flex items-center list-none cursor-pointer [&::-webkit-details-marker]:hidden',
            '[details[open]>summary>*]:text-fg',
            INDENT,
          )}
        >
          <span class="p-1 rounded-md text-mute hover:bg-hover hover:text-fg transition-colors">
            <Caret />
          </span>
          <NavRow node={props.node} trail={trail()} active={isActive()} ctx={props.ctx} />
        </summary>
        <div class="pb-2">
          <NavGroups groups={props.node.children ?? []} depth={props.depth + 1} trail={trail()} ctx={props.ctx} />
        </div>
      </details>
    </Show>
  )
}

const NavRow = (props: { node: TreeNode; trail: string; active: boolean; ctx: Ctx }) => {
  const Link = props.ctx.link ?? PlainLink
  return (
    <Show
      when={props.node.href}
      fallback={
        <span class={cn(ROW, 'font-mono')}>
          <span class="w-3.5 shrink-0" />
          <span class="truncate">{props.node.label}</span>
        </span>
      }
    >
      {(href) => (
        <Link
          href={href()}
          class={ROW}
          classList={{ '!text-fg font-medium': props.active }}
          onClick={() => props.ctx.onNavigate?.(props.node, props.trail)}
        >
          {props.node.badge}
          <span class="font-mono truncate">{props.node.label}</span>
        </Link>
      )}
    </Show>
  )
}

const hasChildren = (node: TreeNode) => (node.children ?? []).some((g) => g.items.length > 0)

const INDENT = 'pl-[calc(var(--nav-depth)*var(--sidebar-indent,0.75rem))]'

const ROW =
  'flex-1 flex items-center gap-2 rounded-md px-1.5 py-1 min-w-0 text-mute hover:bg-hover hover:text-fg transition-colors'
