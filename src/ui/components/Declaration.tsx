import { For, Show, type Component } from 'solid-js'
import { Dynamic } from 'solid-js/web'

import { createSlot, type Types } from '../context/index.tsx'
import { Type, TypeSignature } from './Type.tsx'
import { Comment } from './Comment/index.tsx'
import { Syntax } from './Syntax.tsx'

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

export const DeclarationFunction = (props: { decl: Types.Declaration<'function'> }) => (
  <div class="mt-2">
    <For each={props.decl.signatures}>
      {(sig) => <Type.SignatureLine sig={sig} name={props.decl.name} id={props.decl.id} kind="function" />}
    </For>
    <Comment comment={props.decl.comment} />
  </div>
)

export const DeclarationVariable = (props: { decl: Types.Declaration<'variable'> }) => (
  <div>
    <div class="font-mono text-sm leading-relaxed">
      <Syntax.Kw>const </Syntax.Kw>
      <span class="font-semibold">{props.decl.name}</span>
      <Syntax.Punct>: </Syntax.Punct>
      <Type type={props.decl.type} />
      <Show when={props.decl.defaultValue}>
        <Syntax.Punct>{` = ${props.decl.defaultValue}`}</Syntax.Punct>
      </Show>
    </div>
    <Comment comment={props.decl.comment} />
  </div>
)

export const DeclarationTypeAlias = (props: { decl: Types.Declaration<'type-alias'> }) => (
  <div>
    <div class="font-mono text-sm leading-relaxed">
      <Syntax.Kw>type </Syntax.Kw>
      <span class="font-semibold">{props.decl.name}</span>
      <Type.Generics generics={props.decl.generics} />
      <Syntax.Punct> = </Syntax.Punct>
      <Type type={props.decl.type} />
    </div>
    <Comment comment={props.decl.comment} />
  </div>
)

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
      <Type type={props.prop.type} />
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
    <Type type={props.sig.parameter.type} />
    <Syntax.Punct>]: </Syntax.Punct>
    <Type type={props.sig.type} />
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
      <For each={props.constructors}>{(sig) => <TypeSignature sig={sig} name="constructor" kind="constructor" />}</For>
    </MemberSection>
    <MemberSection title="Properties" when={props.properties?.length || props.indexSignature}>
      <For each={props.properties}>{(p) => <PropertyRow prop={p} />}</For>
      <Show when={props.indexSignature}>{(sig) => <IndexRow sig={sig()} />}</Show>
    </MemberSection>
    <MemberSection title="Methods" when={props.methods?.length}>
      <For each={props.methods}>
        {(m) => <For each={m.signatures}>{(sig) => <TypeSignature sig={sig} name={m.name} kind="method" />}</For>}
      </For>
    </MemberSection>
    <MemberSection title="Call Signatures" when={props.callSignatures?.length}>
      <For each={props.callSignatures}>{(sig) => <TypeSignature sig={sig} />}</For>
    </MemberSection>
    <MemberSection title="Construct Signatures" when={props.constructSignatures?.length}>
      <For each={props.constructSignatures}>{(sig) => <TypeSignature sig={sig} kind="constructor" />}</For>
    </MemberSection>
  </>
)

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

export const DeclarationModule = (props: { decl: Types.Declaration<'module'> }) => (
  <Comment comment={props.decl.comment} />
)

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
