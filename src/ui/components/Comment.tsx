import { createMemo, For, Show } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

import { createSlot, type Types } from '../context/index.ts'
import { useCommentMarkdown } from '../hooks/index.ts'

import { CodeBlock } from './Code/index.tsx'
import { Markdown } from './Markdown.tsx'
import { Type } from './Type.tsx'
import { Link } from './Link.tsx'

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
  return (
    <Show when={props.comment}>
      {(c) => {
        const summary = useCommentMarkdown(c)
        const groups = createMemo(() => groupTags(c().tags ?? []))

        return (
          <Show when={summary() || props.comment?.tags?.length}>
            <div class={props.class}>
              <Show when={summary()}>{(c) => <Markdown source={c()} />}</Show>
              <For each={groups()}>
                {(g) => {
                  if (g.kind === '@param') return <Parameters tags={g.items} />
                  if (g.kind === '@property') return <Properties tags={g.items} />
                  if (g.tag.tag === '@module') return null
                  return <Tag tag={g.tag} />
                }}
              </For>
            </div>
          </Show>
        )
      }}
    </Show>
  )
})

const Properties = createSlot('comment.properties', (p) => <NamedTable title="Properties" tags={p.tags} />)
const Parameters = createSlot('comment.parameters', (p) => <NamedTable title="Parameters" tags={p.tags} />)

const NamedTable = (props: {
  title: string
  tags: Types.CommentTagMap['@property'][] | Types.CommentTagMap['@param'][]
}) => {
  return (
    <section class="mt-6">
      <div class="flex items-baseline gap-2 mb-2">
        <h4 class="text-mute uppercase text-[0.7rem] font-semibold tracking-wider">{props.title}</h4>
      </div>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 items-baseline">
        <For each={props.tags}>{(it) => <NamedRow item={it} />}</For>
      </dl>
    </section>
  )
}

const NamedRow = (props: { item: Types.CommentTagMap['@property'] | Types.CommentTagMap['@param'] }) => (
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

type Named = Types.CommentTagMap['@property'] | Types.CommentTagMap['@param']

/** Strip a single leading `- ` so `@param foo - desc` collapses cleanly. */
const trimLead = (s: string): string => (s ?? '').replace(/^\s*-\s*/, '').trim()

type Group =
  | { kind: '@param'; items: Types.CommentTagMap['@param'][] }
  | { kind: '@property'; items: Types.CommentTagMap['@property'][] }
  | { kind: 'tag'; tag: Types.CommentTag }

const groupTags = (tags: Types.CommentTag[]): Group[] => {
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

export const Tag = createSlot('tag', (props) => {
  if (props.tag.tag === '@returns') return <TagReturns tag={props.tag as Types.CommentTagMap['@returns']} />
  if (props.tag.tag === '@throws') return <TagThrows tag={props.tag as Types.CommentTagMap['@throws']} />
  if (props.tag.tag === '@type') return <TagType tag={props.tag as Types.CommentTagMap['@type']} />
  if (props.tag.tag === '@satisfies') return <TagSatisfies tag={props.tag as Types.CommentTagMap['@satisfies']} />
  if (props.tag.tag === '@example') return <TagExample tag={props.tag as Types.CommentTagMap['@example']} />
  if (props.tag.tag === '@see') return <TagSee tag={props.tag as Types.CommentTagMap['@see']} />
  if (props.tag.tag === '@template') return <TagTemplate tag={props.tag as Types.CommentTagMap['@template']} />
  return <TagOther tag={props.tag} />
})

/** Section frame shared across tag renderers. */
export const TagSection = (props: { tag: Types.CommentTag; description?: string; children: JSX.Element }) => (
  <section class="mt-6">
    <div class="flex items-baseline gap-2 mb-2">
      <TagTitle tag={props.tag} />
      <Show when={props.description}>
        {(description) => (
          <div class="text-xs text-mute min-w-0">
            <Markdown.Inline source={description()} />
          </div>
        )}
      </Show>
    </div>
    {props.children}
  </section>
)

const TagTitle = (props: { tag: Types.CommentTag }) => {
  const title = props.tag.tag.replace(/^@/, '')
  return <h4 class="text-mute uppercase text-[0.7rem] font-semibold tracking-wider">{title}</h4>
}

export const TagExample = createSlot('tag.example', (props: { tag: Types.CommentTagMap['@example'] }) => (
  <TagSection tag={props.tag}>
    <CodeBlock code={props.tag.code} />
  </TagSection>
))

export const TagReturns = createSlot('tag.returns', (props: { tag: Types.CommentTagMap['@returns'] }) => (
  <TagSection tag={props.tag}>
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
))

export const TagSatisfies = createSlot('tag.satisfies', (props: { tag: Types.CommentTagMap['@satisfies'] }) => (
  <TagSection tag={props.tag}>
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
))

export const TagSee = createSlot('tag.see', (props: { tag: Types.CommentTagMap['@see'] }) => (
  <TagSection tag={props.tag}>
    <Show when={props.tag.target}>
      <div class="font-mono text-sm mb-1">
        <Link.ByName name={props.tag.target ?? ''} />
      </div>
    </Show>
  </TagSection>
))

export const TagTemplate = createSlot('tag.template', (props: { tag: Types.CommentTagMap['@template'] }) => (
  <TagSection tag={props.tag}>
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 items-baseline">
      <For each={props.tag.generics}>
        {(tp) => (
          <>
            <dt class="font-mono text-sm font-semibold">{tp.name}</dt>
            <dd class="text-sm text-mute">
              <Show when={tp.constraint}>
                <>
                  <span class="text-accent">extends </span>
                  <Type type={tp.constraint!} />
                </>
              </Show>
            </dd>
          </>
        )}
      </For>
    </dl>
    <Show when={props.tag.text?.trim()}>
      <div class="mt-2">
        <Markdown.Inline source={props.tag.text} />
      </div>
    </Show>
  </TagSection>
))

export const TagThrows = createSlot('tag.throws', (props: { tag: Types.CommentTagMap['@throws'] }) => (
  <TagSection tag={props.tag}>
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
))

export const TagType = createSlot('tag.type', (props: { tag: Types.CommentTagMap['@type'] }) => (
  <TagSection tag={props.tag}>
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
))

export const TagOther = createSlot('tag.*', (props) => (
  <TagSection tag={props.tag}>
    <Markdown source={(props.tag as { text?: string }).text ?? ''} />
  </TagSection>
))
