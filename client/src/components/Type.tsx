import type { JSONOutput } from 'typedoc'
import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import { useIndex } from '../context/index.js'

type T = JSONOutput.SomeType
type Reflection = JSONOutput.DeclarationReflection | JSONOutput.SignatureReflection

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

const ReferenceType = (props: { type: JSONOutput.ReferenceType }) => {
  const idx = useIndex()
  const target = (props.type as { target?: number | { qualifiedName?: string } }).target
  const targetId = typeof target === 'number' ? target : undefined
  const slug = targetId != null ? idx.slugById.get(targetId) : undefined
  const name = props.type.name
  return (
    <>
      <Show when={slug} fallback={<Name>{name}</Name>}>
        <A href={`/r/${slug}`} class="underline decoration-line underline-offset-[3px] hover:opacity-70">
          {name}
        </A>
      </Show>
      <TypeArgs args={props.type.typeArguments} />
    </>
  )
}

const ReflectionType = (props: { type: JSONOutput.ReflectionType }) => {
  const decl = props.type.declaration
  // Function-like: only signatures, no children
  if (decl.signatures?.length && !(decl.children?.length || decl.indexSignatures?.length)) {
    const sig = decl.signatures[0]
    return <SignatureExpr sig={sig} arrow />
  }
  const children = decl.children ?? []
  return (
    <>
      <Punct>{'{ '}</Punct>
      <For each={children}>
        {(c, i) => (
          <>
            <Show when={i() > 0}>
              <Punct>{', '}</Punct>
            </Show>
            <Name>{c.name}</Name>
            <Show when={(c.flags as JSONOutput.ReflectionFlags | undefined)?.isOptional}>
              <Punct>?</Punct>
            </Show>
            <Punct>: </Punct>
            <Show when={c.type}>
              <Type type={c.type as T} />
            </Show>
          </>
        )}
      </For>
      <Punct>{' }'}</Punct>
    </>
  )
}

export const SignatureExpr = (props: { sig: JSONOutput.SignatureReflection; arrow?: boolean }) => (
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
            <Show when={tp.type}>
              <>
                <Kw> extends </Kw>
                <Type type={tp.type as T} />
              </>
            </Show>
          </>
        )}
      </For>
      <Punct>{'>'}</Punct>
    </Show>
    <Punct>(</Punct>
    <For each={props.sig.parameters ?? []}>
      {(p, i) => (
        <>
          <Show when={i() > 0}>
            <Punct>{', '}</Punct>
          </Show>
          <Show when={(p.flags as JSONOutput.ReflectionFlags | undefined)?.isRest}>
            <Punct>...</Punct>
          </Show>
          <Name>{p.name}</Name>
          <Show when={(p.flags as JSONOutput.ReflectionFlags | undefined)?.isOptional || p.defaultValue}>
            <Punct>?</Punct>
          </Show>
          <Show when={p.type}>
            <>
              <Punct>: </Punct>
              <Type type={p.type as T} />
            </>
          </Show>
        </>
      )}
    </For>
    <Punct>)</Punct>
    <Show when={props.sig.type}>
      <>
        <Punct>{props.arrow ? ' => ' : ': '}</Punct>
        <Type type={props.sig.type as T} />
      </>
    </Show>
  </>
)

export const Type = (props: { type: T | undefined }): any => {
  const t = props.type
  if (!t) return null
  switch (t.type) {
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
          <Type type={t.elementType as T} />
          <Punct>[]</Punct>
        </>
      )
    case 'tuple':
      return (
        <>
          <Punct>[</Punct>
          <Join sep=", " items={(t.elements ?? []) as T[]} />
          <Punct>]</Punct>
        </>
      )
    case 'union':
      return <Join sep=" | " items={t.types as T[]} />
    case 'intersection':
      return <Join sep=" & " items={t.types as T[]} />
    case 'reflection':
      return <ReflectionType type={t} />
    case 'typeOperator':
      return (
        <>
          <Kw>{t.operator}</Kw>
          <span> </span>
          <Type type={t.target as T} />
        </>
      )
    case 'query':
      return (
        <>
          <Kw>typeof</Kw>
          <span> </span>
          <Type type={t.queryType as T} />
        </>
      )
    case 'indexedAccess':
      return (
        <>
          <Type type={t.objectType as T} />
          <Punct>[</Punct>
          <Type type={t.indexType as T} />
          <Punct>]</Punct>
        </>
      )
    case 'conditional':
      return (
        <>
          <Type type={t.checkType as T} />
          <Kw> extends </Kw>
          <Type type={t.extendsType as T} />
          <Punct> ? </Punct>
          <Type type={t.trueType as T} />
          <Punct> : </Punct>
          <Type type={t.falseType as T} />
        </>
      )
    case 'predicate':
      return (
        <>
          <Show when={t.asserts}>
            <Kw>asserts </Kw>
          </Show>
          <Name>{t.name}</Name>
          <Show when={t.targetType}>
            <>
              <Kw> is </Kw>
              <Type type={t.targetType as T} />
            </>
          </Show>
        </>
      )
    case 'templateLiteral': {
      const head = (t as JSONOutput.TemplateLiteralType).head ?? ''
      const tail = (t as JSONOutput.TemplateLiteralType).tail ?? []
      return (
        <span>
          `{head}
          <For each={tail}>
            {(seg) => (
              <>
                <Punct>{'${'}</Punct>
                <Type type={seg[0] as T} />
                <Punct>{'}'}</Punct>
                <span>{seg[1]}</span>
              </>
            )}
          </For>
          `
        </span>
      )
    }
    case 'mapped': {
      const m = t as JSONOutput.MappedType
      return (
        <>
          <Punct>{'{ ['}</Punct>
          <Name>{m.parameter}</Name>
          <Kw> in </Kw>
          <Type type={m.parameterType as T} />
          <Punct>]</Punct>
          <Show when={m.optionalModifier}>
            <Punct>{m.optionalModifier === '+' ? '?' : '-?'}</Punct>
          </Show>
          <Punct>: </Punct>
          <Type type={m.templateType as T} />
          <Punct>{' }'}</Punct>
        </>
      )
    }
    case 'rest':
      return (
        <>
          <Punct>...</Punct>
          <Type type={(t as JSONOutput.RestType).elementType as T} />
        </>
      )
    case 'optional':
      return (
        <>
          <Type type={(t as JSONOutput.OptionalType).elementType as T} />
          <Punct>?</Punct>
        </>
      )
    case 'namedTupleMember':
      return (
        <>
          <Name>{(t as JSONOutput.NamedTupleMemberType).name}</Name>
          <Show when={(t as JSONOutput.NamedTupleMemberType).isOptional}>
            <Punct>?</Punct>
          </Show>
          <Punct>: </Punct>
          <Type type={(t as JSONOutput.NamedTupleMemberType).element as T} />
        </>
      )
    case 'unknown':
      return <Name>{(t as JSONOutput.UnknownType).name}</Name>
    default:
      return <Name>{(t as { type: string }).type}</Name>
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

// Helper export to render any reflection's "as expression" type
export const reflectionLabel = (r: Reflection): string => r.name
