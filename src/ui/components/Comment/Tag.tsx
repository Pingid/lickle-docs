import { createMemo, For, Show } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import { Dynamic } from 'solid-js/web'

import { createSlot, type Reflect } from '../../context/index.tsx'
import { CodeBlock } from '../Code/index.tsx'
import { Markdown, MarkdownInline } from '../Markdown.tsx'
import * as Type from '../Type.tsx'
import { Link } from '../Link.tsx'

/**
 * Render one JSDoc tag, dispatched to a per-tag renderer (`@example` becomes
 * a code block, `@returns` an inline type, `@see` a link, …). Unknown tags
 * fall back to a generic markdown section. Replaceable via the `tag` slot —
 * the hook point for turning `@example` blocks into `LiveExample`s.
 */
export const Tag = createSlot('tag', (props: { tag: Reflect.CommentTag }) => {
  const renderer = createMemo(() => RENDERERS[props.tag.tag as keyof typeof RENDERERS] ?? TagOther)
  return <Dynamic component={renderer() as any} {...props} />
})

/** Section frame shared across tag renderers: the tag's heading, an optional markdown description, then the body. Use it to keep custom tag renderers visually consistent. */
export const TagSection = (props: { tag: Reflect.CommentTag; description?: string; children: JSX.Element }) => {
  return (
    <section class="mt-6 [&>*:not(:first-child)>p]:mt-0">
      <div class="flex items-baseline gap-2">
        <TagKind kind={props.tag.tag} />
        <Show when={props.description}>
          {(description) => (
            <div class="text-xs text-mute min-w-0">
              <MarkdownInline source={description()} />
            </div>
          )}
        </Show>
      </div>
      {props.children}
    </section>
  )
}

/** The small uppercase heading of a tag section: `'@example'` → "example". */
export const TagKind = (p: { kind: string }) => (
  <h4 class="text-mute text-[0.7rem] font-semibold tracking-wider mb-1">{p.kind.replace(/^@/, '')}</h4>
)

const TagReturns = (props: { tag: Reflect.CommentTagMap['@returns'] }) => (
  <TagSection tag={props.tag}>
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
)

const TagThrows = (props: { tag: Reflect.CommentTagMap['@throws'] }) => (
  <TagSection tag={props.tag}>
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
)

const TagType = (props: { tag: Reflect.CommentTagMap['@type'] }) => (
  <TagSection tag={props.tag}>
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
)

const TagSatisfies = (props: { tag: Reflect.CommentTagMap['@satisfies'] }) => (
  <TagSection tag={props.tag}>
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
)

const TagExample = (props: { tag: Reflect.CommentTagMap['@example'] }) => (
  <TagSection tag={props.tag} description={props.tag.caption}>
    <CodeBlock code={props.tag.code} lang={props.tag.lang} />
  </TagSection>
)

const TagSee = (props: { tag: Reflect.CommentTagMap['@see'] }) => (
  <TagSection tag={props.tag}>
    <Show when={props.tag.target}>
      <div class="font-mono text-sm mb-1">
        <Link.ByName name={props.tag.target ?? ''} />
      </div>
    </Show>
  </TagSection>
)

const TagTemplate = (props: { tag: Reflect.CommentTagMap['@template'] }) => (
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
                  <Type.Type type={tp.constraint!} />
                </>
              </Show>
            </dd>
          </>
        )}
      </For>
    </dl>
    <Show when={props.tag.text?.trim()}>
      <div class="mt-2">
        <MarkdownInline source={props.tag.text} />
      </div>
    </Show>
  </TagSection>
)

const TagOther = (props: { tag: Reflect.CommentTag }) => (
  <TagSection tag={props.tag} description={(props.tag as { caption?: string }).caption}>
    <Markdown source={(props.tag as { text?: string }).text ?? ''} />
  </TagSection>
)

const RENDERERS = {
  '@returns': TagReturns,
  '@throws': TagThrows,
  '@type': TagType,
  '@satisfies': TagSatisfies,
  '@example': TagExample,
  '@see': TagSee,
  '@template': TagTemplate,
  '*': TagOther,
}
