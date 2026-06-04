import { createMemo, For, Show } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import { Dynamic } from 'solid-js/web'

import { createSlot, type Types } from '../../context/index.tsx'
import { CodeBlock } from '../Code/index.tsx'
import { Markdown } from '../Markdown.tsx'
import { Type } from '../Type.tsx'
import { Link } from '../Link.tsx'

export const Tag = createSlot('tag', (props: { tag: Types.CommentTag }) => {
  const renderer = createMemo(() => RENDERERS[props.tag.tag as keyof typeof RENDERERS] ?? TagOther)
  return <Dynamic component={renderer() as any} {...props} />
})

/** Section frame shared across tag renderers. */
export const TagSection = (props: { tag: Types.CommentTag; description?: string; children: JSX.Element }) => {
  const title = props.tag.tag.replace(/^@/, '')
  return (
    <section class="mt-6">
      <div class="flex items-baseline gap-2 mb-2">
        <h4 class="text-mute uppercase text-[0.7rem] font-semibold tracking-wider">{title}</h4>
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
}

const TagReturns = (props: { tag: Types.CommentTagMap['@returns'] }) => (
  <TagSection tag={props.tag}>
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
)

const TagThrows = (props: { tag: Types.CommentTagMap['@throws'] }) => (
  <TagSection tag={props.tag}>
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
)

const TagType = (props: { tag: Types.CommentTagMap['@type'] }) => (
  <TagSection tag={props.tag}>
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
)

const TagSatisfies = (props: { tag: Types.CommentTagMap['@satisfies'] }) => (
  <TagSection tag={props.tag}>
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
)

const TagExample = (props: { tag: Types.CommentTagMap['@example'] }) => (
  <TagSection tag={props.tag}>
    <CodeBlock code={props.tag.code} />
  </TagSection>
)

const TagSee = (props: { tag: Types.CommentTagMap['@see'] }) => (
  <TagSection tag={props.tag}>
    <Show when={props.tag.target}>
      <div class="font-mono text-sm mb-1">
        <Link.ByName name={props.tag.target ?? ''} />
      </div>
    </Show>
  </TagSection>
)

const TagTemplate = (props: { tag: Types.CommentTagMap['@template'] }) => (
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
)

const TagOther = (props: { tag: Types.CommentTag }) => (
  <TagSection tag={props.tag}>
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
