import { Show, type JSX } from 'solid-js'
import type * as docs from '@lickle/docs'

import { Markdown } from '../../components/Markdown.js'
import { Type } from '../../components/Type.js'

/** Markdown with top/bottom block margins trimmed — for table cells / short rows. */
export const InlineText = (props: { source: string }) => <Markdown class="lk-md-inline" source={props.source} />

/** Section frame shared across tag renderers. */
export const Section = (props: { title: string; description?: string; children: JSX.Element }) => (
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

/** Type pill + caption — used for `@returns`, `@throws`, `@type`, `@satisfies`. */
export const TypedText = (props: { title: string; tag: { type?: docs.Type; text: string } }) => (
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

/** Bare text section — used for `@deprecated`, `@author`, `@default`. */
export const TextBlock = (props: { title: string; text: string }) => (
  <Section title={props.title}>
    <InlineText source={props.text} />
  </Section>
)
