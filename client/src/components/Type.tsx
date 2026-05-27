import type * as docs from '@lickle/docs'
import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import { useProject } from '../context/index.js'

type T = docs.Type

const Punct = (p: { children: string }) => <span class="text-mute">{p.children}</span>
const Kw = (p: { children: string }) => <span class="text-accent">{p.children}</span>
const Name = (p: { children: string }) => <span>{p.children}</span>

const Join = (props: { sep: string; items: T[] }) => (
  <For each={props.items}>
    {(t, i) => (
      <>
        <Show when={i() > 0}>
          <Punct>{props.sep}</Punct>
        </Show>
        <Type type={t} />
      </>
    )}
  </For>
)

const TypeArgs = (props: { args?: T[] }) => (
  <Show when={props.args?.length}>
    <Punct>{'<'}</Punct>
    <Join sep=", " items={props.args!} />
    <Punct>{'>'}</Punct>
  </Show>
)

const ReferenceType = (props: { type: docs.Reference }) => {
  const { project } = useProject()
  const target = props.type.target
  const slug = target ? project.slugById.get(target.id) : undefined
  const external = props.type.external
  return (
    <>
      <Show when={external === 'anonymous'}>
        <Punct>?</Punct>
      </Show>
      <Show when={slug} fallback={<Name>{props.type.name}</Name>}>
        <A href={`/r/${slug}`} class="underline decoration-line underline-offset-[3px] hover:opacity-70">
          {props.type.name}
        </A>
      </Show>
      <TypeArgs args={props.type.typeArguments} />
    </>
  )
}

const ReflectionType = (props: { type: docs.ReflectionType }) => {
  const decl = props.type.declaration
  const onlySignatures =
    decl.callSignatures?.length &&
    !decl.properties.length &&
    !decl.methods?.length &&
    !decl.indexSignature &&
    !decl.constructSignatures?.length
  if (onlySignatures) return <SignatureExpr sig={decl.callSignatures![0]!} arrow />
  return (
    <>
      <Punct>{'{ '}</Punct>
      <For each={decl.properties}>
        {(p, i) => (
          <>
            <Show when={i() > 0}>
              <Punct>{', '}</Punct>
            </Show>
            <Name>{p.name}</Name>
            <Show when={p.optional}>
              <Punct>?</Punct>
            </Show>
            <Punct>: </Punct>
            <Type type={p.type} />
          </>
        )}
      </For>
      <Punct>{' }'}</Punct>
    </>
  )
}

const TupleElement = (props: { el: docs.TupleElement }) => (
  <>
    <Show when={props.el.rest}>
      <Punct>...</Punct>
    </Show>
    <Show when={props.el.name}>
      <>
        <Name>{props.el.name!}</Name>
        <Show when={props.el.optional}>
          <Punct>?</Punct>
        </Show>
        <Punct>: </Punct>
      </>
    </Show>
    <Type type={props.el.type} />
    <Show when={!props.el.name && props.el.optional}>
      <Punct>?</Punct>
    </Show>
  </>
)

export const SignatureExpr = (props: { sig: docs.Signature; arrow?: boolean }) => (
  <>
    <Show when={props.sig.typeParameters?.length}>
      <Punct>{'<'}</Punct>
      <For each={props.sig.typeParameters!}>
        {(tp, i) => (
          <>
            <Show when={i() > 0}>
              <Punct>{', '}</Punct>
            </Show>
            <Name>{tp.name}</Name>
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
          <Name>{p.name}</Name>
          <Show when={p.optional || p.default != null}>
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
        <Punct>{props.arrow ? ' => ' : ': '}</Punct>
        <Type type={props.sig.type} />
      </>
    </Show>
  </>
)

export const Type = (props: { type: T | undefined }): any => {
  const t = props.type
  if (!t) return null
  switch (t.kind) {
    case 'intrinsic':
      return <Kw>{t.name}</Kw>
    case 'literal':
      if (typeof t.value === 'string') return <span class="text-fg">"{t.value}"</span>
      if (t.value === null) return <Kw>null</Kw>
      return <span>{String(t.value)}</span>
    case 'reference':
      return <ReferenceType type={t} />
    case 'array':
      return (
        <>
          <Type type={t.elementType} />
          <Punct>[]</Punct>
        </>
      )
    case 'tuple':
      return (
        <>
          <Punct>[</Punct>
          <For each={t.elements}>
            {(el, i) => (
              <>
                <Show when={i() > 0}>
                  <Punct>{', '}</Punct>
                </Show>
                <TupleElement el={el} />
              </>
            )}
          </For>
          <Punct>]</Punct>
        </>
      )
    case 'union':
      return <Join sep=" | " items={t.types} />
    case 'intersection':
      return <Join sep=" & " items={t.types} />
    case 'function-type':
      return (
        <Show when={t.signatures[0]} fallback={<Kw>function</Kw>}>
          {(sig) => <SignatureExpr sig={sig()} arrow />}
        </Show>
      )
    case 'reflection':
      return <ReflectionType type={t} />
    case 'type-operator':
      return (
        <>
          <Kw>{t.operator}</Kw>
          <span> </span>
          <Type type={t.target} />
        </>
      )
    case 'query':
      return (
        <>
          <Kw>typeof</Kw>
          <span> </span>
          <Type type={t.queryType as docs.Reference} />
        </>
      )
    default:
      return <Name>{(t as { kind: string }).kind}</Name>
  }
}

export const TypeBlock = (props: { type: T | undefined }) => (
  <code class="font-mono text-[0.85em] leading-relaxed">
    <Type type={props.type} />
  </code>
)

export const TypeBox = (props: { type: T | undefined; class?: string }) => (
  <div class={`codeblock ${props.class ?? ''}`}>
    <Type type={props.type} />
  </div>
)
