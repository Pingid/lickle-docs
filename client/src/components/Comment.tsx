import { For, Show } from 'solid-js'
import type * as docs from '@lickle/docs'

import { useSlugFor } from '../hooks/index.js'
import { useComponents } from '../registry/context.js'
import { useProject, useReflectionId } from '../context/project.js'
import { defaultTags, UnknownTag } from '../theme/tags/index.js'
import { Markdown } from './Markdown.js'
import { Type } from './Type.js'

type Tag = docs.CommentTag
type TagOf<K extends keyof docs.CommentTagMap> = docs.CommentTagMap[K]

/**
 * Render a single doc comment: summary markdown first, then every tag in
 * source order. Consecutive `@param` (or `@property`) runs are merged into
 * one labelled table so a five-parameter signature reads as one block.
 *
 * Per-tag rendering goes through the component registry — `defaults` from
 * `theme/tags/`, with user overrides taking precedence. Unknown tags fall
 * through to {@link UnknownTag}.
 */
export const Comment = (props: { comment?: docs.Comment; class?: string }) => {
  const slugs = useSlugFor()
  const slugOf = (name: string) => slugs.byName(name)
  return (
    <Show when={props.comment}>
      {(c) => {
        const summary = () => commentToMarkdown(c(), slugOf)
        const groups = () => groupTags(c().tags ?? [])
        return (
          <Show when={summary() || groups().length}>
            <div class={props.class}>
              <Show when={summary()}>
                <Markdown source={summary()} />
              </Show>
              <For each={groups()}>{(g) => <TagGroup group={g} />}</For>
            </div>
          </Show>
        )
      }}
    </Show>
  )
}

/** Single-line plain-text preview of a comment. Used by listings/cards. */
export const commentSummaryText = (comment: docs.Comment | undefined): string => {
  if (!comment) return ''
  let out = ''
  for (const p of comment.parts) {
    if (p.kind === 'text') out += p.text
    else out += p.text ?? p.target
  }
  return out.trim()
}

// ============================================================================
// GROUPING
// One pass over `comment.tags`. Adjacent `@param` / `@property` collapse into
// one block; anything else stays put.
// ============================================================================

type Group =
  | { kind: '@param'; items: TagOf<'@param'>[] }
  | { kind: '@property'; items: TagOf<'@property'>[] }
  | { kind: 'tag'; tag: Tag }

const groupTags = (tags: Tag[]): Group[] => {
  const out: Group[] = []
  const pushRun = <K extends '@param' | '@property'>(kind: K, item: TagOf<K>) => {
    const last = out[out.length - 1]
    if (last && last.kind === kind) (last.items as TagOf<K>[]).push(item)
    else out.push({ kind, items: [item] } as Group)
  }
  for (const t of tags) {
    if (t.tag === '@param') pushRun('@param', t as TagOf<'@param'>)
    else if (t.tag === '@property') pushRun('@property', t as TagOf<'@property'>)
    else out.push({ kind: 'tag', tag: t })
  }
  return out
}

// ============================================================================
// PER-GROUP RENDERING
// ============================================================================

const TagGroup = (props: { group: Group }) => {
  const g = props.group
  if (g.kind === '@param') return <NamedTable title="Parameters" items={g.items} />
  if (g.kind === '@property') return <NamedTable title="Properties" items={g.items} />
  return <TagDispatch tag={g.tag} />
}

/**
 * Per-tag dispatch. Lookup order: user override → stock theme entry →
 * {@link UnknownTag}. The enclosing declaration is passed through so custom
 * tags can render context-aware content (e.g. an `@runnable` button needs
 * the decl id).
 */
const TagDispatch = (props: { tag: Tag }) => {
  const { tags } = useComponents()
  const id = useReflectionId()
  const { project } = useProject()
  const decl = () => (id != null && id >= 0 ? project.declarationsById.get(id) : undefined)
  const Render = (tags?.[props.tag.tag] ?? defaultTags[props.tag.tag] ?? UnknownTag) as (p: {
    tag: Tag
    decl?: docs.Declaration
  }) => any
  return <Render tag={props.tag} decl={decl()} />
}

type Named = TagOf<'@param'> | TagOf<'@property'>

const NamedTable = (props: { title: string; items: Named[] }) => (
  <section class="mt-6">
    <div class="flex items-baseline gap-2 mb-2">
      <h4 class="text-mute uppercase text-[0.7rem] font-semibold tracking-wider">{props.title}</h4>
    </div>
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 items-baseline">
      <For each={props.items}>{(it) => <NamedRow item={it} />}</For>
    </dl>
  </section>
)

const NamedRow = (props: { item: Named }) => (
  <>
    <dt class="font-mono text-sm whitespace-nowrap">
      <span class="font-semibold">{props.item.name}</span>
      <Show when={props.item.optional}>
        <span class="text-mute">?</span>
      </Show>
      <Show when={props.item.type}>
        <>
          <span class="text-mute">: </span>
          <Type type={props.item.type!} />
        </>
      </Show>
      <Show when={props.item.default}>
        <span class="text-mute"> = {props.item.default}</span>
      </Show>
    </dt>
    <dd class="text-sm text-mute min-w-0">
      <Show when={trimLead(props.item.text)}>
        <Markdown class="lk-md-inline" source={trimLead(props.item.text)} />
      </Show>
    </dd>
  </>
)

// ============================================================================
// HELPERS
// ============================================================================

/** Strip a single leading `- ` so `@param foo - desc` collapses cleanly. */
const trimLead = (s: string): string => (s ?? '').replace(/^\s*-\s*/, '').trim()

/**
 * Render structured `comment.parts` to markdown, resolving inline `{@link}`
 * references via the slug lookup.
 */
const commentToMarkdown = (comment: docs.Comment, slugOf: (name: string) => string | undefined): string => {
  let out = ''
  for (const p of comment.parts) {
    if (p.kind === 'text') {
      out += p.text
      continue
    }
    const label = p.text ?? p.target
    const slug = slugOf(p.target)
    const display = p.style === 'code' ? `\`${label}\`` : label
    out += slug ? `[${display}](/r/${slug})` : display
  }
  return out
}
