import { For, Show } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import { A } from '@solidjs/router'
import type * as docs from '@lickle/docs'

import { useProject } from '../context/index.js'
import type { Tag } from '../api.js'
import { Markdown } from './Markdown.js'
import { Type } from './Type.js'

type TagOf<K extends keyof docs.CommentTagMap> = docs.CommentTagMap[K]

/**
 * Render a single doc comment: summary markdown first, then every tag in
 * source order. Consecutive `@param` (or `@property`) runs are merged into
 * one labelled table so a five-parameter signature reads as one block.
 *
 * No code preview / handler registry — `@example` renders as plain markdown
 * via {@link Markdown}, which already hands fenced blocks off to shiki.
 */
export const Comment = (props: { comment?: docs.Comment; class?: string }) => {
  const { slugByName } = useProject()
  const slugOf = (name: string) => slugByName.get(name)
  return (
    <Show when={props.comment}>
      {(c) => {
        const summary = () => commentToMarkdown(c(), slugOf)
        const groups = () => groupTags(c().tags)
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
export const commentSummaryText = (comment: docs.Comment | undefined): string => comment?.text.trim() ?? ''

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
  return <TagBlock tag={g.tag} />
}

type Named = TagOf<'@param'> | TagOf<'@property'>

const NamedTable = (props: { title: string; items: Named[] }) => (
  <Section title={props.title}>
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 items-baseline">
      <For each={props.items}>{(it) => <NamedRow item={it} />}</For>
    </dl>
  </Section>
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
        <InlineText source={trimLead(props.item.text)} />
      </Show>
    </dd>
  </>
)

// ============================================================================
// PER-TAG RENDERING
// One small component per known tag kind, with an `UnknownTag` fallback.
// ============================================================================

const TagBlock = (props: { tag: Tag }) => {
  const t = props.tag
  console.log(t)
  if (t.tag === '@returns') return <TypedText title="Returns" tag={t as TagOf<'@returns'>} />
  if (t.tag === '@throws') return <TypedText title="Throws" tag={t as TagOf<'@throws'>} />
  if (t.tag === '@type') return <TypedText title="Type" tag={t as TagOf<'@type'>} />
  if (t.tag === '@satisfies') return <TypedText title="Satisfies" tag={t as TagOf<'@satisfies'>} />
  if (t.tag === '@example' && 'code' in t) return <ExampleBlock tag={t as TagOf<'@example'>} />
  if (t.tag === '@see') return <SeeBlock tag={t as TagOf<'@see'>} />
  if (t.tag === '@template') return <TemplateBlock tag={t as TagOf<'@template'>} />
  if (t.tag === '@deprecated') return <TextBlock title="Deprecated" text={t.text} />
  if (t.tag === '@remarks')
    return (
      <Section title="Remarks">
        <Markdown source={t.text} />
      </Section>
    )
  if (t.tag === '@author') return <TextBlock title="Author" text={t.text} />
  if (t.tag === '@default') return <TextBlock title="Default" text={t.text} />
  return <UnknownTag tag={t.tag} text={(t as { text?: string }).text ?? ''} />
}

const Section = (props: { title: string; description?: string; children: JSX.Element }) => (
  <section class="mt-6">
    <div class="flex items-baseline gap-2 mb-2">
      <h4 class="text-mute uppercase text-[0.7rem] font-semibold tracking-wider">{props.title}</h4>
      <Show when={props.description}>
        {(description) => (
          <div class="text-xs text-mute min-w-0">
            <InlineText source={description()} />
          </div>
        )}
      </Show>
    </div>
    {props.children}
  </section>
)

type WithMaybeType = { type?: docs.Type; text: string }

const TypedText = (props: { title: string; tag: WithMaybeType }) => (
  <Section title={props.title}>
    <Show when={props.tag.type}>
      <div class="font-mono text-sm mb-1">
        <Type type={props.tag.type!} />
      </div>
    </Show>
    <Show when={props.tag.text?.trim()}>
      <InlineText source={props.tag.text} />
    </Show>
  </Section>
)

const TextBlock = (props: { title: string; text: string }) => (
  <Section title={props.title}>
    <InlineText source={props.text} />
  </Section>
)

const ExampleBlock = (props: { tag: TagOf<'@example'> }) => (
  <Section title="Example" description={props.tag.caption}>
    <Markdown source={ensureFenced(props.tag.code)} />
  </Section>
)

const SeeBlock = (props: { tag: TagOf<'@see'> }) => {
  const { slugByName } = useProject()
  const slug = () => (props.tag.target ? slugByName.get(props.tag.target) : undefined)
  return (
    <Section title="See">
      <Show when={props.tag.target}>
        <div class="font-mono text-sm mb-1">
          <Show when={slug()} fallback={<span>{props.tag.target}</span>}>
            <A href={`/r/${slug()}`} class="underline decoration-line underline-offset-[3px] hover:opacity-70">
              {props.tag.target}
            </A>
          </Show>
        </div>
      </Show>
      <Show when={props.tag.text?.trim()}>
        <InlineText source={props.tag.text} />
      </Show>
    </Section>
  )
}

const TemplateBlock = (props: { tag: TagOf<'@template'> }) => (
  <Section title="Type Parameters">
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 items-baseline">
      <For each={props.tag.typeParameters}>
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
        <InlineText source={props.tag.text} />
      </div>
    </Show>
  </Section>
)

const UnknownTag = (props: { tag: string; text: string }) => (
  <Section title={prettifyTagName(props.tag)}>
    <Markdown source={props.text} />
  </Section>
)

// ============================================================================
// HELPERS
// ============================================================================

/** Markdown with top/bottom block margins trimmed — for table cells / short rows. */
const InlineText = (props: { source: string }) => <Markdown class="lk-md-inline" source={props.source} />

/** Strip a single leading `- ` so `@param foo - desc` collapses cleanly. */
const trimLead = (s: string): string => (s ?? '').replace(/^\s*-\s*/, '').trim()

/** Wrap raw code in a default ```ts fence if it isn't already fenced. */
const ensureFenced = (code: string): string => (/^\s*```/.test(code) ? code : '```ts\n' + code + '\n```')

/** `@deprecated` → `Deprecated`, `@runnable` → `Runnable`. */
const prettifyTagName = (tag: string): string => {
  const bare = tag.replace(/^@/, '')
  return bare.charAt(0).toUpperCase() + bare.slice(1)
}

/**
 * Convert structured `comment.parts` to markdown, resolving inline `{@link}`
 * references via the slug lookup. Falls back to `comment.text` when `parts`
 * isn't populated.
 */
const commentToMarkdown = (comment: docs.Comment, slugOf: (name: string) => string | undefined): string => {
  if (!comment.parts?.length) return comment.text
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
