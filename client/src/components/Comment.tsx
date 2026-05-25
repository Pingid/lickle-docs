import { For, Show, createContext, createEffect, createMemo, createSignal, onCleanup, useContext } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import type { JSONOutput } from 'typedoc'

import { handlerOf, type TagHandler, type TagPart } from '../api.js'
import { useIndex } from '../context/index.js'
import { Markdown } from './Markdown.js'
import { Editor } from './Editor.js'

type Part = JSONOutput.CommentDisplayPart

const ReflectionIdCtx = createContext<number>(-1)

/** Scope a subtree to a reflection id so nested `<Comment>`s pass it to tag handlers. */
export const ReflectionScope = (props: { id: number; children: JSX.Element }) => (
  <ReflectionIdCtx.Provider value={props.id}>{props.children}</ReflectionIdCtx.Provider>
)

const partsToMarkdown = (parts: Part[] | undefined, slugOf: (id: number) => string | undefined): string => {
  if (!parts?.length) return ''
  let out = ''
  for (const p of parts) {
    if (p.kind === 'text' || p.kind === 'code') {
      out += p.text
    } else if (p.kind === 'inline-tag') {
      const text = p.text ?? ''
      const target = (p as { target?: number | string }).target
      if (p.tag === '@link' || p.tag === '@linkcode' || p.tag === '@linkplain') {
        if (typeof target === 'number') {
          const slug = slugOf(target)
          if (slug) {
            const label = text.trim() || String(target)
            const display = p.tag === '@linkcode' ? `\`${label}\`` : label
            out += `[${display}](/r/${slug})`
            continue
          }
        }
        out += text
      } else {
        out += text
      }
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

const FENCE = /^```(\w+)?\r?\n([\s\S]*?)\r?\n```\s*$/

type Parsed = { code: string; raw: string; title: string; language: string }

/** Pull the first fenced code body + language + leading title out of `@<tag>` content. */
const parseTagContent = (parts: Part[] | undefined): Parsed => {
  let raw = ''
  let titleSoFar = ''
  let firstCode: string | null = null
  for (const p of parts ?? []) {
    if (p.kind === 'text') {
      raw += p.text
      if (firstCode === null) titleSoFar += p.text
    } else if (p.kind === 'code') {
      raw += p.text
      if (firstCode === null) firstCode = p.text
    } else if (p.kind === 'inline-tag') {
      raw += (p as { text?: string }).text ?? ''
    }
  }
  if (firstCode == null) return { code: raw.trim(), raw, title: '', language: '' }
  const m = firstCode.match(FENCE)
  if (!m) return { code: firstCode.trim(), raw, title: titleSoFar.trim(), language: '' }
  return { code: m[2] ?? '', raw, title: titleSoFar.trim(), language: m[1] || '' }
}

export const Comment = (props: { comment?: JSONOutput.Comment; class?: string }) => {
  const idx = useIndex()
  const slugOf = (id: number) => idx.slugById.get(id)
  const reflectionId = useContext(ReflectionIdCtx)

  return (
    <Show when={props.comment}>
      {(c) => {
        const summary = () => partsToMarkdown(c().summary, slugOf)
        const tags = () => c().blockTags ?? []
        return (
          <div class={props.class}>
            <Show when={summary()}>
              <Markdown source={summary()} />
            </Show>
            <For each={tags()}>{(t) => <TagBlock tag={t} reflectionId={reflectionId} slugOf={slugOf} />}</For>
          </div>
        )
      }}
    </Show>
  )
}

const TagBlock = (props: {
  tag: JSONOutput.CommentTag
  reflectionId: number
  slugOf: (id: number) => string | undefined
}) => {
  const parsed = createMemo(() => parseTagContent(props.tag.content))
  const handler = createMemo(() => handlerOf(props.tag.tag))
  const label = () => BLOCK_TAG_LABELS[props.tag.tag]
  const hasFence = () => parsed().language !== ''

  // Live-editable copy of the code; resets when navigating between examples.
  const [code, setCode] = createSignal(parsed().code)
  createEffect(() => setCode(parsed().code))

  return (
    <Show when={hasFence() || handler() || label()}>
      <div class={`lk-tag lk-tag-${props.tag.tag.replace(/^@/, '')} mt-6`}>
        <Show when={label() || parsed().title}>
          <h4 class="text-mute uppercase text-[0.7rem] font-semibold mb-2 tracking-wider">
            {label() ?? parsed().title}
          </h4>
        </Show>

        <Show when={hasFence()} fallback={<NonFenceBody tag={props.tag} parsed={parsed()} slugOf={props.slugOf} />}>
          <Editor code={parsed().code} language={parsed().language} onChange={setCode} />
        </Show>

        <Show when={handler()}>
          {(h) => (
            <Preview handler={h()} code={code} parsed={parsed()} tag={props.tag} reflectionId={props.reflectionId} />
          )}
        </Show>
      </div>
    </Show>
  )
}

/** Tag content without a fenced block — fall back to a parsed markdown rendering. */
const NonFenceBody = (props: {
  tag: JSONOutput.CommentTag
  parsed: Parsed
  slugOf: (id: number) => string | undefined
}) => {
  const md = () => partsToMarkdown(props.tag.content, props.slugOf)
  return (
    <Show when={md()}>
      <Markdown source={md()} />
    </Show>
  )
}

const RUN_DEBOUNCE_MS = 250

const Preview = (props: {
  handler: TagHandler
  /** Live code (re-runs the handler on change). */
  code: () => string
  parsed: Parsed
  tag: JSONOutput.CommentTag
  reflectionId: number
}) => {
  let slot!: HTMLDivElement
  let cleanup: void | (() => void)
  let timer: ReturnType<typeof setTimeout> | undefined

  const teardown = () => {
    try {
      cleanup?.()
    } catch (err) {
      console.warn('[lickle-docs] preview cleanup threw', err)
    }
    cleanup = undefined
    slot.replaceChildren()
    slot.classList.remove('lk-preview-err')
  }

  const exec = (code: string) => {
    teardown()
    try {
      cleanup = props.handler(slot, code, {
        raw: props.parsed.raw,
        title: props.parsed.title,
        language: props.parsed.language,
        content: (props.tag.content ?? []) as ReadonlyArray<TagPart>,
        reflectionId: props.reflectionId,
        tag: props.tag.tag,
      })
    } catch (err) {
      slot.textContent = String(err)
      slot.classList.add('lk-preview-err')
    }
  }

  createEffect(() => {
    const code = props.code()
    clearTimeout(timer)
    if (cleanup === undefined) exec(code)
    else timer = setTimeout(() => exec(code), RUN_DEBOUNCE_MS)
  })

  onCleanup(() => {
    clearTimeout(timer)
    teardown()
  })

  return <div ref={slot} class="lk-preview" />
}

export const commentSummaryText = (comment: JSONOutput.Comment | undefined): string => {
  if (!comment?.summary) return ''
  return comment.summary
    .map((p) => (p.kind === 'text' || p.kind === 'code' ? p.text : ((p as { text?: string }).text ?? '')))
    .join('')
    .trim()
}
