import type { JSX } from 'solid-js/jsx-runtime'
import { For, Show } from 'solid-js'

import { type Types } from '../context/index.ts'

import { createSlot } from '../context/components.tsx'

import { Markdown } from './Markdown.tsx'
import { Type } from './Type.tsx'
import { Link } from './Link.tsx'

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
export const TagSection = (props: { title: string; description?: string; children: JSX.Element }) => (
  <section class="mt-6">
    <div class="flex items-baseline gap-2 mb-2">
      <h4 class="text-mute uppercase text-[0.7rem] font-semibold tracking-wider">{props.title}</h4>
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

export const TagExample = createSlot('tag.example', (props: { tag: Types.CommentTagMap['@example'] }) => (
  <TagSection title="Example">
    <Markdown.Inline source={ensureFenced(props.tag.code)} />
  </TagSection>
))

export const TagReturns = createSlot('tag.returns', (props: { tag: Types.CommentTagMap['@returns'] }) => (
  <TagSection title="Returns">
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
))

export const TagSatisfies = createSlot('tag.satisfies', (props: { tag: Types.CommentTagMap['@satisfies'] }) => (
  <TagSection title="Satisfies">
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
))

export const TagSee = createSlot('tag.see', (props: { tag: Types.CommentTagMap['@see'] }) => (
  <TagSection title="See">
    <Show when={props.tag.target}>
      <div class="font-mono text-sm mb-1">
        <Link.ByName name={props.tag.target ?? ''} />
      </div>
    </Show>
  </TagSection>
))

export const TagTemplate = createSlot('tag.template', (props: { tag: Types.CommentTagMap['@template'] }) => (
  <TagSection title="Type Parameters">
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
  <TagSection title="Throws">
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
))

export const TagType = createSlot('tag.type', (props: { tag: Types.CommentTagMap['@type'] }) => (
  <TagSection title="Type">
    <Type.Inline type={props.tag.type} text={props.tag.text} />
  </TagSection>
))

export const TagOther = createSlot('tag.*', (props) => (
  <TagSection title={prettifyTagName(props.tag.tag)}>
    <Markdown source={(props.tag as { text?: string }).text ?? ''} />
  </TagSection>
))

const ensureFenced = (code: string): string => (/^\s*```/.test(code) ? code : '```ts\n' + code + '\n```')

/** `@\deprecated` → `Deprecated`, `@\runnable` → `Runnable`. */
const prettifyTagName = (tag: string): string => {
  const bare = tag.replace(/^@/, '')
  return bare.charAt(0).toUpperCase() + bare.slice(1)
}
