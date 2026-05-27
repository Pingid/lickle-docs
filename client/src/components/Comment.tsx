import { For, Show, createMemo } from 'solid-js'
import type * as docs from '@lickle/docs'

import { useProject } from '../context/index.js'
import { handlerOf, type Tag } from '../api.js'
import { Markdown } from './Markdown.js'
import { Type } from './Type.jsx'

type TagKind<T extends keyof docs.CommentTagMap = keyof docs.CommentTagMap> = docs.CommentTagMap[T]

export const Comment = (props: { comment?: docs.Comment; class?: string }) => {
  const { slugByName } = useProject()
  const slugOf = (name: string) => slugByName.get(name)

  return (
    <Show when={props.comment}>
      {(c) => {
        const summary = () => commentToMarkdown(c(), slugOf)
        const tags = () => c().tags
        return (
          <div class={props.class}>
            <Show when={summary()}>
              <Markdown source={summary()} />
            </Show>
            <Tags tags={tags()} />
          </div>
        )
      }}
    </Show>
  )
}

export const Text = (props: { text: string }) => <div class="text-fg">{props.text}</div>

export const Tags = (props: { tags: Tag[] }) => {
  let known: { t: TagKind[]; k: TagKind['tag'] }[] = [{ t: [], k: '@param' }]
  let unknown: Tag[] = []
  for (const t of props.tags) {
    const current = known[known.length - 1]
    if (t.tag === '@param') {
      if (current.k === '@param' && current.t.length > 0) {
        current.t.push(t as TagKind<'@param'>)
      } else {
        known.push({ t: [t as TagKind], k: '@param' })
      }
    }
  }

  return (
    <>
      <For each={known}>
        {(b) => {
          if (b.k === '@param') return <Params tags={b.t as TagKind<'@param'>[]} />
          if (b.k === '@property') return ''
          if (b.k === '@returns') return ''
          if (b.k === '@throws') return ''
          if (b.k === '@type') return ''
          if (b.k === '@satisfies') return ''
          if (b.k === '@template') return ''
          if (b.k === '@see') return ''
          if (b.k === '@example') return ''
          if (b.k === '@remarks') return ''
          if (b.k === '@deprecated') return ''
          return null
        }}
      </For>
      <For each={unknown}>{(t) => '...'}</For>
    </>
  )
}

export const Params = (props: { tags: TagKind<'@param'>[] }) => {
  if (props.tags.length === 0) return null
  return (
    <div class="">
      <h4 class="text-mute text-xs">parameters</h4>
      <For each={props.tags}>{(t) => <TagParam tag={t} />}</For>
    </div>
  )
}

export const TagParam = (props: { tag: TagKind<'@param'> }) => {
  return (
    <div class="text-fg pl-2">
      <span class="text-mute text-xs font-semibold tracking-wider">{props.tag.name}</span>
      <span class="pr-2">:</span>
      <Show when={props.tag.type}>{(t) => <Type type={t()} />}</Show>
      <span class="text-mute text-xs">{props.tag.text}</span>
    </div>
  )
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
    if (slug) {
      const display = p.style === 'code' ? `\`${label}\`` : label
      out += `[${display}](/r/${slug})`
    } else {
      out += p.style === 'code' ? `\`${label}\`` : label
    }
  }
  return out
}

const BLOCK_TAG_LABELS: Record<string, string> = {
  '@example': 'Example',
  '@remarks': 'Remarks',
  '@see': 'See',
  '@deprecated': 'Deprecated',
  '@throws': 'Throws',
  '@returns': 'Returns',
}

/** Tags handled elsewhere (parameter table, type aliases, etc.) — skip in the comment block. */
const SKIP_IN_BLOCK = new Set(['@param', '@property', '@template', '@type', '@satisfies'])

const FENCE = /```(\w+)?\r?\n([\s\S]*?)\r?\n```/

type Parsed = { code: string; raw: string; title: string; language: string }

/**
 * Pull body text + fenced code + language out of an arbitrary tag. `@example`
 * arrives pre-parsed by the schema, so we use its `code`/`caption` directly.
 * Everything else carries a markdown `text` field that may contain a fence.
 */
const parseTag = (tag: Tag): Parsed => {
  // The unknown-tag catch-all in the schema uses `tag: string`, which prevents
  // a literal-only narrow. Pair the discriminator with a structural check.
  if (tag.tag === '@example' && 'code' in tag) {
    // Schema's `@example.code` may itself still be wrapped in a ```lang fence.
    const m = tag.code.match(FENCE)
    const inner = m ? (m[2] ?? '') : tag.code
    const language = m ? m[1] || 'ts' : 'ts'
    return { code: inner, raw: tag.code, title: tag.caption ?? '', language }
  }
  const text = (tag as { text?: string }).text ?? ''
  const m = text.match(FENCE)
  if (!m) return { code: text.trim(), raw: text, title: '', language: '' }
  const title = text.slice(0, m.index).trim()
  return { code: m[2] ?? '', raw: text, title, language: m[1] || '' }
}

export const OldComment = (props: { comment?: docs.Comment; class?: string }) => {
  const { slugByName } = useProject()
  const slugOf = (name: string) => slugByName.get(name)

  return (
    <Show when={props.comment}>
      {(c) => {
        const summary = () => commentToMarkdown(c(), slugOf)
        const tags = () => c().tags.filter((t: Tag) => !SKIP_IN_BLOCK.has(t.tag))
        return (
          <div class={props.class}>
            <Show when={summary()}>
              <Markdown source={summary()} />
            </Show>
            <For each={tags()}>{(t) => <TagBlock tag={t} />}</For>
          </div>
        )
      }}
    </Show>
  )
}

const TagBlock = (props: { tag: Tag }) => {
  const parsed = createMemo(() => parseTag(props.tag))
  const handler = createMemo(() => handlerOf(props.tag.tag))
  const label = () => BLOCK_TAG_LABELS[props.tag.tag]
  const hasFence = () => parsed().language !== ''

  // Live-editable copy of the code; resets when navigating between examples.

  return (
    <Show when={hasFence() || handler() || label()}>
      <div class={`lk-tag lk-tag-${props.tag.tag.replace(/^@/, '')} mt-6`}>
        <Show when={label() || parsed().title}>
          <h4 class="text-mute uppercase text-[0.7rem] font-semibold mb-2 tracking-wider">
            {label() ?? parsed().title}
          </h4>
        </Show>
      </div>
    </Show>
  )
}

export const commentSummaryText = (comment: docs.Comment | undefined): string => comment?.text.trim() ?? ''
