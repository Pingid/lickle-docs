import { For, Show, createContext, createEffect, createMemo, createSignal, onCleanup, useContext } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import type { index } from '@lickle/docs'

import { handlerOf, type Tag, type TagHandler } from '../api.js'
import { useProject } from '../context/index.js'
import { Markdown } from './Markdown.js'
import { Editor } from './Editor.js'

const ReflectionIdCtx = createContext<number>(-1)

/** Scope a subtree to a reflection id so nested `<Comment>`s pass it to tag handlers. */
export const ReflectionScope = (props: { id: number; children: JSX.Element }) => (
  <ReflectionIdCtx.Provider value={props.id}>{props.children}</ReflectionIdCtx.Provider>
)

/**
 * Convert structured `comment.parts` to markdown, resolving inline `{@link}`
 * references via the slug lookup. Falls back to `comment.text` when `parts`
 * isn't populated.
 */
const commentToMarkdown = (comment: index.Comment, slugOf: (name: string) => string | undefined): string => {
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
    return { code: tag.code, raw: tag.code, title: tag.caption ?? '', language: 'ts' }
  }
  const text = (tag as { text?: string }).text ?? ''
  const m = text.match(FENCE)
  if (!m) return { code: text.trim(), raw: text, title: '', language: '' }
  const title = text.slice(0, m.index).trim()
  return { code: m[2] ?? '', raw: text, title, language: m[1] || '' }
}

export const Comment = (props: { comment?: index.Comment; class?: string }) => {
  const { slugByName } = useProject()
  const slugOf = (name: string) => slugByName.get(name)
  const reflectionId = useContext(ReflectionIdCtx)

  return (
    <Show when={props.comment}>
      {(c) => {
        const summary = () => commentToMarkdown(c(), slugOf)
        const tags = () => c().tags.filter((t) => !SKIP_IN_BLOCK.has(t.tag))
        return (
          <div class={props.class}>
            <Show when={summary()}>
              <Markdown source={summary()} />
            </Show>
            <For each={tags()}>{(t) => <TagBlock tag={t} reflectionId={reflectionId} />}</For>
          </div>
        )
      }}
    </Show>
  )
}

const TagBlock = (props: { tag: Tag; reflectionId: number }) => {
  const parsed = createMemo(() => parseTag(props.tag))
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

        <Show when={hasFence()} fallback={<NonFenceBody tag={props.tag} />}>
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
const NonFenceBody = (props: { tag: Tag }) => {
  const md = () => (props.tag as { text?: string }).text ?? ''
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
  tag: Tag
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
        tag: props.tag,
        reflectionId: props.reflectionId,
        title: props.parsed.title,
        language: props.parsed.language,
        raw: props.parsed.raw,
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

export const commentSummaryText = (comment: index.Comment | undefined): string => comment?.text.trim() ?? ''
