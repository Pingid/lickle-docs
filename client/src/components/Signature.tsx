import type * as docs from '@lickle/docs'
import { For, Show } from 'solid-js'

import { Comment } from './Comment.js'
import { Type } from './Type.js'

const Punct = (p: { children: string }) => <span class="text-mute">{p.children}</span>
const Kw = (p: { children: string }) => <span class="text-accent">{p.children}</span>

const isOptional = (p: docs.Parameter): boolean => p.optional || p.default != null

export const SignatureLine = (props: {
  sig: docs.Signature
  name?: string
  kind?: 'function' | 'method' | 'constructor'
}) => (
  <div class="font-mono text-sm leading-relaxed py-2">
    <Show when={props.kind === 'constructor'}>
      <Kw>new </Kw>
    </Show>
    <Show when={props.name}>
      <span class="font-semibold">{props.name}</span>
    </Show>
    <Show when={props.sig.typeParameters?.length}>
      <Punct>{'<'}</Punct>
      <For each={props.sig.typeParameters!}>
        {(tp, i) => (
          <>
            <Show when={i() > 0}>
              <Punct>{', '}</Punct>
            </Show>
            <span>{tp.name}</span>
            <Show when={tp.constraint}>
              <>
                <Kw> extends </Kw>
                <Type type={tp.constraint!} />
              </>
            </Show>
          </>
        )}
      </For>
      <Punct>{'>'}</Punct>
    </Show>
    <Punct>(</Punct>
    <For each={props.sig.parameters}>
      {(p, i) => (
        <>
          <Show when={i() > 0}>
            <Punct>{', '}</Punct>
          </Show>
          <Show when={p.rest}>
            <Punct>...</Punct>
          </Show>
          <span>{p.name}</span>
          <Show when={isOptional(p)}>
            <Punct>?</Punct>
          </Show>
          <Punct>: </Punct>
          <Type type={p.type} />
        </>
      )}
    </For>
    <Punct>)</Punct>
    <Show when={props.sig.type}>
      <>
        <Punct>: </Punct>
        <Type type={props.sig.type} />
      </>
    </Show>
  </div>
)

/**
 * Type signature + its doc block. Parameter descriptions come from the
 * `@param` tags inside `sig.comment` and are rendered by `<Comment>` itself,
 * so there's no separate parameter table here.
 */
export const Signature = (props: {
  sig: docs.Signature
  name?: string
  kind?: 'function' | 'method' | 'constructor'
}) => (
  <div class="mb-8">
    <SignatureLine sig={props.sig} name={props.name} kind={props.kind} />
    <Show when={props.sig.comment}>
      <div class="mt-2">
        <Comment comment={props.sig.comment} />
      </div>
    </Show>
  </div>
)
