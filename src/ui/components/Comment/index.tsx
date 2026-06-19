import { createMemo, For, Show } from 'solid-js'

import { createSlot, type Reflect } from '../../context/index.tsx'
import { useCommentMarkdown } from '../../hooks/index.ts'
import { staticComponent } from '../../util/solid.tsx'

import { Markdown, MarkdownInline } from '../Markdown.tsx'
import { Tag, TagKind } from './Tag.tsx'
import { Type } from '../Type.tsx'

export * from './Tag.tsx'

/**
 * Render a single doc comment: summary markdown first, then every tag in
 * source order. Consecutive `@param` (or `@property`) runs are merged into
 * one labelled table so a five-parameter signature reads as one block.
 *
 * Per-tag rendering goes through the component registry — `defaults` from
 * `theme/tags/`, with user overrides taking precedence. Unknown tags fall
 * through to {@link UnknownTag}.
 */
export const Comment = createSlot('comment', (props) => {
  const summary = useCommentMarkdown(() => props.comment)
  const groups = createMemo(() => groupTags(props.comment?.tags ?? []))

  return (
    <Show when={summary() || props.comment?.tags?.length}>
      <div class={props.class}>
        <Show when={summary()}>{(md) => <Markdown source={md()} />}</Show>
        <For each={groups()}>
          {(g) => {
            if (g.kind === '@param') return <NamedTable title="Parameters" tags={g.items} />
            if (g.kind === '@property') return <NamedTable title="Properties" tags={g.items} />
            return <Tag tag={g.tag} />
          }}
        </For>
      </div>
    </Show>
  )
})

const NamedTable = staticComponent(
  (props: { title: string; tags: Reflect.CommentTagMap['@property'][] | Reflect.CommentTagMap['@param'][] }) => {
    return (
      <section class="mt-6">
        <div class="flex items-baseline gap-2 mb-2">
          <TagKind kind={props.title} />
        </div>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 items-baseline">
          <For each={props.tags}>{(it) => <NamedRow item={it} />}</For>
        </dl>
      </section>
    )
  },
)

const NamedRow = staticComponent(
  (props: { item: Reflect.CommentTagMap['@property'] | Reflect.CommentTagMap['@param'] }) => (
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
          <MarkdownInline source={trimLead(props.item.text)} />
        </Show>
      </dd>
    </>
  ),
)

type Named = Reflect.CommentTagMap['@property'] | Reflect.CommentTagMap['@param']

/** Strip a single leading `- ` so `@param foo - desc` collapses cleanly. */
const trimLead = (s: string): string => (s ?? '').replace(/^\s*-\s*/, '').trim()

type Group =
  | { kind: '@param'; items: Reflect.CommentTagMap['@param'][] }
  | { kind: '@property'; items: Reflect.CommentTagMap['@property'][] }
  | { kind: 'tag'; tag: Reflect.CommentTag }

const groupTags = (tags: Reflect.CommentTag[]): Group[] => {
  const out: Group[] = []
  const pushRun = <K extends '@param' | '@property'>(kind: K, item: Named) => {
    const last = out[out.length - 1]
    if (last && last.kind === kind) (last.items as Named[]).push(item)
    else out.push({ kind, items: [item] } as Group)
  }
  for (const t of tags) {
    if (t.tag === '@param') pushRun('@param', t as Named)
    else if (t.tag === '@property') pushRun('@property', t as Named)
    else out.push({ kind: 'tag', tag: t })
  }
  return out
}
