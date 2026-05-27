import type { index } from '@lickle/docs'
import { For, Show } from 'solid-js'

import { Comment } from './Comment.js'
import { Type } from './Type.js'

const Punct = (p: { children: string }) => <span class="text-mute">{p.children}</span>
const Kw = (p: { children: string }) => <span class="text-accent">{p.children}</span>

const isOptional = (p: index.Parameter): boolean => p.optional || p.default != null

export const SignatureLine = (props: {
  sig: index.Signature
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

const ParameterRow = (props: { param: index.Parameter }) => (
  <div class="grid grid-cols-[auto_1fr] gap-x-3 items-baseline">
    <dt class="font-mono text-sm">
      <span class="font-semibold">{props.param.name}</span>
      <Show when={isOptional(props.param)}>
        <span class="text-mute">?</span>
      </Show>
    </dt>
    <dd class="text-sm text-mute min-w-0">
      <Show when={props.param.comment}>
        <Comment comment={props.param.comment} />
      </Show>
    </dd>
  </div>
)

export const Signature = (props: {
  sig: index.Signature
  name?: string
  kind?: 'function' | 'method' | 'constructor'
}) => (
  <div class="mb-6">
    <SignatureLine sig={props.sig} name={props.name} kind={props.kind} />
    <Show when={props.sig.comment}>
      <div class="mt-3">
        <Comment comment={props.sig.comment} />
      </div>
    </Show>
    <Show when={props.sig.parameters.length}>
      <div class="mt-5">
        <h4 class="text-mute text-xs mb-2">Parameters</h4>
        <dl class="space-y-1.5">
          <For each={props.sig.parameters}>{(p) => <ParameterRow param={p} />}</For>
        </dl>
      </div>
    </Show>
  </div>
)
