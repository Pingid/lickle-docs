import { For, Show } from 'solid-js'

import type * as docs from '../../core/client.ts'

import { Kind, labelOf, shortOf } from '../util/kind.ts'
import { useDisplay } from '../context/index.ts'

import { Markdown } from './Markdown.tsx'
import { Comment } from './Comment.tsx'
import { Syntax } from './Syntax.tsx'
import { Link } from './Link.tsx'

type T = docs.Type

export const Type = (props: { type: T | undefined }): any => {
  const t = props.type
  if (!t) return null
  switch (t.kind) {
    case 'intrinsic':
      return <Syntax.Kw>{t.name}</Syntax.Kw>
    case 'literal':
      if (typeof t.value === 'string') return <span class="text-fg">"{t.value}"</span>
      if (t.value === null) return <Syntax.Kw>null</Syntax.Kw>
      return <span>{String(t.value)}</span>
    case 'reference':
      return <Type.ReferenceType type={t} />
    case 'array':
      return (
        <>
          <Type type={t.elementType} />
          <Syntax.Punct>[]</Syntax.Punct>
        </>
      )
    case 'tuple':
      return (
        <>
          <Syntax.Punct>[</Syntax.Punct>
          <For each={t.elements}>
            {(el, i) => (
              <>
                <Show when={i() > 0}>
                  <Syntax.Punct>{', '}</Syntax.Punct>
                </Show>
                <TupleElement el={el} />
              </>
            )}
          </For>
          <Syntax.Punct>]</Syntax.Punct>
        </>
      )
    case 'union':
      return <Type.Join sep=" | " items={t.types} />
    case 'intersection':
      return <Type.Join sep=" & " items={t.types} />
    case 'function-type':
      return (
        <Show when={t.signatures[0]} fallback={<Syntax.Kw>function</Syntax.Kw>}>
          {(sig) => <Type.SignatureExpr sig={sig()} arrow />}
        </Show>
      )
    case 'reflection':
      return <Type.ReflectionType type={t} />
    case 'type-operator':
      return (
        <>
          <Syntax.Kw>{t.operator}</Syntax.Kw>
          <span> </span>
          <Type type={t.target} />
        </>
      )
    case 'query':
      return (
        <>
          <Syntax.Kw>typeof</Syntax.Kw>
          <span> </span>
          <Type type={t.queryType as docs.Reference} />
        </>
      )
    default:
      return <Syntax.Name>{(t as { kind: string }).kind}</Syntax.Name>
  }
}

Type.Join = (props: { sep: string; items: T[] }) => (
  <For each={props.items}>
    {(t, i) => (
      <>
        <Show when={i() > 0}>
          <Syntax.Punct>{props.sep}</Syntax.Punct>
        </Show>
        <Type type={t} />
      </>
    )}
  </For>
)

Type.TypeArgs = (props: { args?: T[] }) => (
  <Show when={props.args?.length}>
    <Syntax.Punct>{'<'}</Syntax.Punct>
    <Type.Join sep=", " items={props.args!} />
    <Syntax.Punct>{'>'}</Syntax.Punct>
  </Show>
)

Type.ReferenceType = (props: { type: docs.Reference }) => (
  <>
    <Link.Type id={props.type.target?.id} name={props.type.name} external={props.type.external} />
    <Type.TypeArgs args={props.type.typeArguments} />
  </>
)

Type.ReflectionType = (props: { type: docs.ReflectionType }) => {
  const decl = props.type.declaration
  const onlySignatures =
    decl.callSignatures?.length &&
    !decl.properties.length &&
    !decl.methods?.length &&
    !decl.indexSignature &&
    !decl.constructSignatures?.length
  if (onlySignatures) return <Type.SignatureExpr sig={decl.callSignatures![0]!} arrow />
  return (
    <>
      <Syntax.Punct>{'{ '}</Syntax.Punct>
      <For each={decl.properties}>
        {(p, i) => (
          <>
            <Show when={i() > 0}>
              <Syntax.Punct>{', '}</Syntax.Punct>
            </Show>
            <Syntax.Name>{p.name}</Syntax.Name>
            <Show when={p.optional}>
              <Syntax.Punct>?</Syntax.Punct>
            </Show>
            <Syntax.Punct>: </Syntax.Punct>
            <Type type={p.type} />
          </>
        )}
      </For>
      <Syntax.Punct>{' }'}</Syntax.Punct>
    </>
  )
}

const TupleElement = (props: { el: docs.TupleElement }) => (
  <>
    <Show when={props.el.rest}>
      <Syntax.Punct>...</Syntax.Punct>
    </Show>
    <Show when={props.el.name}>
      <>
        <Syntax.Name>{props.el.name!}</Syntax.Name>
        <Show when={props.el.optional}>
          <Syntax.Punct>?</Syntax.Punct>
        </Show>
        <Syntax.Punct>: </Syntax.Punct>
      </>
    </Show>
    <Type type={props.el.type} />
    <Show when={!props.el.name && props.el.optional}>
      <Syntax.Punct>?</Syntax.Punct>
    </Show>
  </>
)

Type.SignatureExpr = (props: { sig: docs.Signature; arrow?: boolean }) => (
  <>
    <Show when={props.sig.typeParameters?.length}>
      <Syntax.Punct>{'<'}</Syntax.Punct>
      <For each={props.sig.typeParameters!}>
        {(tp, i) => (
          <>
            <Show when={i() > 0}>
              <Syntax.Punct>{', '}</Syntax.Punct>
            </Show>
            <Syntax.Name>{tp.name}</Syntax.Name>
            <Show when={tp.constraint}>
              <>
                <Syntax.Kw> extends </Syntax.Kw>
                <Type type={tp.constraint!} />
              </>
            </Show>
          </>
        )}
      </For>
      <Syntax.Punct>{'>'}</Syntax.Punct>
    </Show>
    <Syntax.Punct>(</Syntax.Punct>
    <For each={props.sig.parameters}>
      {(p, i) => (
        <>
          <Show when={i() > 0}>
            <Syntax.Punct>{', '}</Syntax.Punct>
          </Show>
          <Show when={p.rest}>
            <Syntax.Punct>...</Syntax.Punct>
          </Show>
          <Syntax.Name>{p.name}</Syntax.Name>
          <Show when={p.optional || p.default != null}>
            <Syntax.Punct>?</Syntax.Punct>
          </Show>
          <Syntax.Punct>: </Syntax.Punct>
          <Type type={p.type} />
        </>
      )}
    </For>
    <Syntax.Punct>)</Syntax.Punct>
    <Show when={props.sig.type}>
      <>
        <Syntax.Punct>{props.arrow ? ' => ' : ': '}</Syntax.Punct>
        <Type type={props.sig.type} />
      </>
    </Show>
  </>
)

Type.TypeBlock = (props: { type: T | undefined }) => (
  <code class="font-mono text-[0.85em] leading-relaxed">
    <Type type={props.type} />
  </code>
)

Type.TypeBox = (props: { type: T | undefined; class?: string }) => (
  <div class={`codeblock ${props.class ?? ''}`}>
    <Type type={props.type} />
  </div>
)

Type.Inline = (props: { type?: docs.Type; text: string }) => (
  <>
    <Show when={props.type}>
      <div class="font-mono text-sm mb-1">
        <Type type={props.type!} />
      </div>
    </Show>
    <Show when={props.text?.trim()}>
      <Markdown.Inline source={props.text} />
    </Show>
  </>
)

/**
 * Single-glyph badge for a declaration kind. Use in dense lists (sidebar,
 * member cards, search palette) where a `K` / `ƒ` cue is enough.
 */
Type.KindBadge = (props: { kind: Kind | string; class?: string }) => (
  <span class={`font-mono text-xs text-mute text-center ${props.class ?? ''}`} title={labelOf(props.kind)}>
    {shortOf(props.kind)}
  </span>
)

/** Tracked uppercase label for a declaration kind (`MODULE`, `FUNCTION`, …). */
Type.KindLabel = (props: { kind: Kind | string; class?: string }) => (
  <span class={`text-xs uppercase tracking-wider text-mute ${props.class ?? ''}`}>{labelOf(props.kind)}</span>
)

const Punct = (p: { children: string }) => <span class="text-mute">{p.children}</span>
const Kw = (p: { children: string }) => <span class="text-accent">{p.children}</span>

const isOptional = (p: docs.Parameter): boolean => p.optional || p.default != null

Type.SignatureLine = (props: { sig: docs.Signature; name?: string; kind?: 'function' | 'method' | 'constructor' }) => (
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
Type.Signature = (props: { sig: docs.Signature; name?: string; kind?: 'function' | 'method' | 'constructor' }) => {
  const display = useDisplay()
  return (
    <Show
      when={display() === 'full'}
      fallback={<Type.SignatureCompact sig={props.sig} name={props.name} kind={props.kind} />}
    >
      <div class="mb-8">
        <Type.SignatureLine sig={props.sig} name={props.name} kind={props.kind} />
        <Show when={props.sig.comment}>
          <div class="mt-2">
            <Comment comment={props.sig.comment} />
          </div>
        </Show>
      </div>
    </Show>
  )
}

Type.SignatureCompact = (props: {
  sig: docs.Signature
  name?: string
  kind?: 'function' | 'method' | 'constructor'
}) => (
  <>
    <Type.SignatureLine sig={props.sig} name={props.name} kind={props.kind} />
    <Comment comment={props.sig.comment} />
  </>
)
