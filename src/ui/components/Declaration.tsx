import { For, Show, type Component } from 'solid-js'
import { Dynamic } from 'solid-js/web'

import { createSlot, type Reflect } from '../context/index.tsx'
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

const dispatch = (kind: Reflect.Declaration['kind']): Component<{ decl: any }> => RENDERERS[kind]

/** Heritage line — `extends A, B` / `implements C`. */
const ExtendsLine = (props: { label: string; types?: Reflect.Type[] }) => (
  <Show when={props.types?.length}>
    <div class="text-sm text-mute font-mono mt-2">
      <span class="text-accent">{props.label} </span>
      <Type.Join sep=", " items={props.types!} />
    </div>
  </Show>
)

/** Function page body: one signature line + doc block per overload. */
const DeclarationFunction = (props: { decl: Reflect.Declaration<'function'> }) => (
  <div class="mt-2">
    <For each={props.decl.signatures}>
      {(sig) => <Type.SignatureLine sig={sig} name={props.decl.name} id={props.decl.id} kind="function" />}
    </For>
    <Comment comment={props.decl.comment} />
  </div>
)

/**
 * Variable page body: `const name: type = default` plus the doc block. A
 * variable holding an object type renders like an interface — member sections
 * below — instead of one long inline record, mirroring the type-alias page.
 */
const DeclarationVariable = (props: { decl: Reflect.Declaration<'variable'> }) => {
  const record = () => {
    const t = props.decl.type
    return t?.kind === 'record' && t.members.length > RECORD_INLINE_MAX ? t : undefined
  }
  return (
    <div>
      <div class="font-mono text-sm leading-relaxed">
        <Syntax.Kw>const </Syntax.Kw>
        <span class="font-semibold">{props.decl.name}</span>
        <Show when={!record()}>
          <Syntax.Punct>: </Syntax.Punct>
          <Type.Type type={props.decl.type} />
          <Show when={props.decl.defaultValue}>
            <Syntax.Punct>{` = ${props.decl.defaultValue}`}</Syntax.Punct>
          </Show>
        </Show>
      </div>
      <Comment comment={props.decl.comment} />
      <Show when={record()}>{(t) => <Type.Members members={t().members} />}</Show>
    </div>
  )
}

/** Records up to this many members stay inline on the variable signature line. */
const RECORD_INLINE_MAX = 3

/**
 * Type-alias page body: `type Name<T> = …` plus the doc block. An alias to
 * an object type with members renders like an interface — member sections
 * with their doc comments — instead of one flattened inline line.
 */
const DeclarationTypeAlias = (props: { decl: Reflect.Declaration<'type-alias'> }) => {
  const record = () => {
    const t = props.decl.type
    if (t?.kind !== 'record' || !t.members.length) return undefined
    return t
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
      <Show when={record()}>{(t) => <Type.Members members={t().members} />}</Show>
    </div>
  )
}

/** Class page body: heritage lines, doc block, then constructors / properties / methods. */
const DeclarationClass = (props: { decl: Reflect.Declaration<'class'> }) => (
  <div>
    <ExtendsLine label="extends" types={props.decl.extends} />
    <ExtendsLine label="implements" types={props.decl.implements} />
    <Comment comment={props.decl.comment} />
    <Type.Members members={props.decl.members} />
  </div>
)

/** Interface page body: heritage line, doc block, then members in source order. */
const DeclarationInterface = (props: { decl: Reflect.Declaration<'interface'> }) => (
  <div>
    <ExtendsLine label="extends" types={props.decl.extends} />
    <Comment comment={props.decl.comment} />
    <Type.Members members={props.decl.members} />
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

/** Enum page body: doc block plus the member table. */
const DeclarationEnum = (props: { decl: Reflect.Declaration<'enum'> }) => (
  <div>
    <Comment comment={props.decl.comment} />
    <MemberSection title="Members" when={props.decl.members?.length}>
      <For each={props.decl.members}>{(m) => <EnumMemberRow member={m} />}</For>
    </MemberSection>
  </div>
)

const EnumMemberRow = (props: { member: Reflect.Part<'enum-member'> }) => (
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
const DeclarationModule = (props: { decl: Reflect.Declaration<'module'> }) => <Comment comment={props.decl.comment} />

/** Namespace page body: the namespace comment. Member listings come from the route's links, rendered by `Page`. */
const DeclarationNamespace = (props: { decl: Reflect.Declaration<'namespace'> }) => (
  <Comment comment={props.decl.comment} />
)

const RENDERERS: Record<Reflect.Declaration['kind'], Component<{ decl: any }>> = {
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
