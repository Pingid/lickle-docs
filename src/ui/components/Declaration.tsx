import { For, Show, type Component } from 'solid-js'
import { Dynamic } from 'solid-js/web'

import { createSlot, type Types } from '../context/index.tsx'
import { Comment } from './Comment/index.tsx'
import { Syntax } from './Syntax.tsx'
import * as Type from './Type.tsx'

/**
 * Dispatch a declaration to its per-kind renderer. Implemented via `Dynamic`
 * (not an `if`/`switch`) so the active sub-component swaps reactively when
 * `props.decl.kind` changes — otherwise navigating between pages of different
 * kinds would freeze on the original branch.
 */
export const Declaration = createSlot('declaration', (props) => (
  <Dynamic component={dispatch(props.decl.kind)} decl={props.decl} />
))

const dispatch = (kind: Types.Declaration['kind']): Component<{ decl: any }> => RENDERERS[kind]

/** Heritage line — `extends A, B` / `implements C`. */
const ExtendsLine = (props: { label: string; types?: Types.Type[] }) => (
  <Show when={props.types?.length}>
    <div class="text-sm text-mute font-mono mt-2">
      <span class="text-accent">{props.label} </span>
      <Type.Join sep=", " items={props.types!} />
    </div>
  </Show>
)

/** Function page body: one signature line + doc block per overload. */
export const DeclarationFunction = (props: { decl: Types.Declaration<'function'> }) => (
  <div class="mt-2">
    <For each={props.decl.signatures}>
      {(sig) => <Type.SignatureLine sig={sig} name={props.decl.name} id={props.decl.id} kind="function" />}
    </For>
    <Comment comment={props.decl.comment} />
  </div>
)

/** Variable page body: `const name: type = default` plus the doc block. */
export const DeclarationVariable = (props: { decl: Types.Declaration<'variable'> }) => (
  <div>
    <div class="font-mono text-sm leading-relaxed">
      <Syntax.Kw>const </Syntax.Kw>
      <span class="font-semibold">{props.decl.name}</span>
      <Syntax.Punct>: </Syntax.Punct>
      <Type.Type type={props.decl.type} />
      <Show when={props.decl.defaultValue}>
        <Syntax.Punct>{` = ${props.decl.defaultValue}`}</Syntax.Punct>
      </Show>
    </div>
    <Comment comment={props.decl.comment} />
  </div>
)

/**
 * Type-alias page body: `type Name<T> = …` plus the doc block. An alias to
 * an object type with members renders like an interface — member sections
 * with their doc comments — instead of one flattened inline line.
 */
export const DeclarationTypeAlias = (props: { decl: Types.Declaration<'type-alias'> }) => {
  const record = () => {
    const t = props.decl.type
    if (t?.kind !== 'record') return undefined
    const hasMembers =
      t.properties.length || t.methods.length || t.callSignatures?.length || t.constructSignatures?.length
    return hasMembers ? t : undefined
  }
  return (
    <div>
      <div class="font-mono text-sm leading-relaxed">
        <Syntax.Kw>type </Syntax.Kw>
        <span class="font-semibold">{props.decl.name}</span>
        <Type.Generics generics={props.decl.generics} />
        <Show when={!record()}>
          <Syntax.Punct> = </Syntax.Punct>
          <Type.Type type={props.decl.type} />
        </Show>
      </div>
      <Comment comment={props.decl.comment} />
      <Show when={record()}>
        {(t) => (
          <Members
            properties={t().properties}
            methods={t().methods}
            callSignatures={t().callSignatures}
            constructSignatures={t().constructSignatures}
            indexSignature={t().indexSignature}
          />
        )}
      </Show>
    </div>
  )
}

/** Class page body: heritage lines, doc block, then constructors / properties / methods. */
export const DeclarationClass = (props: { decl: Types.Declaration<'class'> }) => (
  <div>
    <ExtendsLine label="extends" types={props.decl.extends} />
    <ExtendsLine label="implements" types={props.decl.implements} />
    <Comment comment={props.decl.comment} />
    <Members
      constructors={props.decl.constructors}
      properties={props.decl.properties}
      methods={props.decl.methods}
      indexSignature={props.decl.indexSignature}
    />
  </div>
)

/** Interface page body: heritage line, doc block, then properties / methods / signatures. */
export const DeclarationInterface = (props: { decl: Types.Declaration<'interface'> }) => (
  <div>
    <ExtendsLine label="extends" types={props.decl.extends} />
    <Comment comment={props.decl.comment} />
    <Members
      properties={props.decl.properties}
      methods={props.decl.methods}
      callSignatures={props.decl.callSignatures}
      constructSignatures={props.decl.constructSignatures}
      indexSignature={props.decl.indexSignature}
    />
  </div>
)

/** Section heading matching the module-children layout in `Page.tsx`. */
const MemberSection = (props: { title: string; when: unknown; children: any }) => (
  <Show when={props.when}>
    <section class="mt-8">
      <h2 class="text-sm font-semibold mb-3 pb-1.5 border-b border-line capitalize">{props.title}</h2>
      {props.children}
    </section>
  </Show>
)

const PropertyRow = (props: { prop: Types.Part<'property'> }) => (
  <div class="py-2">
    <div class="font-mono text-sm leading-relaxed">
      <span class="font-semibold">{props.prop.name}</span>
      <Show when={props.prop.optional}>
        <Syntax.Punct>?</Syntax.Punct>
      </Show>
      <Syntax.Punct>: </Syntax.Punct>
      <Type.Type type={props.prop.type} />
      <Show when={props.prop.defaultValue}>
        <Syntax.Punct>{` = ${props.prop.defaultValue}`}</Syntax.Punct>
      </Show>
    </div>
    <Show when={props.prop.comment}>
      <div class="mt-1">
        <Comment comment={props.prop.comment} />
      </div>
    </Show>
  </div>
)

const IndexRow = (props: { sig: Types.Part<'index-signature'> }) => (
  <div class="font-mono text-sm leading-relaxed py-2">
    <Syntax.Punct>[</Syntax.Punct>
    <span class="font-semibold">{props.sig.parameter.name}</span>
    <Syntax.Punct>: </Syntax.Punct>
    <Type.Type type={props.sig.parameter.type} />
    <Syntax.Punct>]: </Syntax.Punct>
    <Type.Type type={props.sig.type} />
  </div>
)

/** Member listing shared by classes and interfaces. */
const Members = (props: {
  constructors?: Types.Part<'signature'>[]
  properties?: Types.Part<'property'>[]
  methods?: Types.Part<'method'>[]
  callSignatures?: Types.Part<'signature'>[]
  constructSignatures?: Types.Part<'signature'>[]
  indexSignature?: Types.Part<'index-signature'>
}) => (
  <>
    <MemberSection title="Constructors" when={props.constructors?.length}>
      <For each={props.constructors}>
        {(sig) => <Type.TypeSignature sig={sig} name="constructor" kind="constructor" />}
      </For>
    </MemberSection>
    <MemberSection title="Properties" when={props.properties?.length || props.indexSignature}>
      <For each={props.properties}>{(p) => <PropertyRow prop={p} />}</For>
      <Show when={props.indexSignature}>{(sig) => <IndexRow sig={sig()} />}</Show>
    </MemberSection>
    <MemberSection title="Methods" when={props.methods?.length}>
      <For each={props.methods}>
        {(m) => <For each={m.signatures}>{(sig) => <Type.TypeSignature sig={sig} name={m.name} kind="method" />}</For>}
      </For>
    </MemberSection>
    <MemberSection title="Call Signatures" when={props.callSignatures?.length}>
      <For each={props.callSignatures}>{(sig) => <Type.TypeSignature sig={sig} />}</For>
    </MemberSection>
    <MemberSection title="Construct Signatures" when={props.constructSignatures?.length}>
      <For each={props.constructSignatures}>{(sig) => <Type.TypeSignature sig={sig} kind="constructor" />}</For>
    </MemberSection>
  </>
)

/** Enum page body: doc block plus the member table. */
export const DeclarationEnum = (props: { decl: Types.Declaration<'enum'> }) => (
  <div>
    <Comment comment={props.decl.comment} />
    <MemberSection title="Members" when={props.decl.members?.length}>
      <For each={props.decl.members}>{(m) => <EnumMemberRow member={m} />}</For>
    </MemberSection>
  </div>
)

const EnumMemberRow = (props: { member: Types.Part<'enum-member'> }) => (
  <div class="py-2">
    <div class="font-mono text-sm leading-relaxed">
      <span class="font-semibold">{props.member.name}</span>
      <Show when={props.member.value !== undefined}>
        <Syntax.Punct>{` = ${typeof props.member.value === 'string' ? `"${props.member.value}"` : props.member.value}`}</Syntax.Punct>
      </Show>
    </div>
    <Show when={props.member.comment}>
      <div class="mt-1">
        <Comment comment={props.member.comment} />
      </div>
    </Show>
  </div>
)

/** Module page body: the module banner comment. Member listings come from the route's links, rendered by `Page`. */
export const DeclarationModule = (props: { decl: Types.Declaration<'module'> }) => (
  <Comment comment={props.decl.comment} />
)

/** Namespace page body: the namespace comment. Member listings come from the route's links, rendered by `Page`. */
export const DeclarationNamespace = (props: { decl: Types.Declaration<'namespace'> }) => (
  <Comment comment={props.decl.comment} />
)

const RENDERERS: Record<Types.Declaration['kind'], Component<{ decl: any }>> = {
  class: DeclarationClass,
  interface: DeclarationInterface,
  enum: DeclarationEnum,
  function: DeclarationFunction,
  variable: DeclarationVariable,
  'type-alias': DeclarationTypeAlias,
  module: DeclarationModule,
  namespace: DeclarationNamespace,
  export: () => null,
}
