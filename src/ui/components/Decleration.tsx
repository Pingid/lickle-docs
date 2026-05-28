import { For, Show, type Component } from 'solid-js'
import { Dynamic } from 'solid-js/web'

import * as docs from '../../core/client.ts'

import { createSlot, DisplayProvider, useDisplay } from '../context/index.ts'
import { Type } from './Type.tsx'
import { Comment } from './Comment.tsx'

/** Class for a row in the compact module-exports list. Plain in full mode. */
const rowClass = (display: () => 'compact' | 'full', full = ''): string =>
  display() === 'compact' ? 'border-b border-line/60 last:border-0 py-2' : full

/**
 * Dispatch a declaration to its per-kind renderer. Implemented via `Dynamic`
 * (not an `if`/`switch`) so that the active sub-component swaps reactively
 * when `props.decl.kind` changes — otherwise navigating between pages of
 * different kinds would freeze on the original branch.
 */
export const Declaration = createSlot('declaration', (props) => (
  <Dynamic component={dispatch(props.decl.kind)} decl={props.decl} />
))

const dispatch = (kind: docs.Declaration['kind']): Component<{ decl: any }> => RENDERERS[kind]

export const DeclarationClass = createSlot('declaration.class', (props) => {
  const display = useDisplay()
  return (
    <Show
      when={display() === 'compact'}
      fallback={
        <>
          <ExtendsLine label="extends" types={props.decl.extends} />
          <ExtendsLine label="implements" types={props.decl.implements} />
        </>
      }
    >
      <NamedRow keyword="class" id={props.decl.id} name={props.decl.name} comment={props.decl.comment} />
    </Show>
  )
})

export const DeclarationEnum = createSlot('declaration.enum', (props) => {
  const display = useDisplay()
  return (
    <Show
      when={display() === 'compact'}
      fallback={<div class="text-mute">TODO {props.decl.kind}</div>}
    >
      <NamedRow keyword="enum" id={props.decl.id} name={props.decl.name} comment={props.decl.comment} />
    </Show>
  )
})

const ExtendsLine = (props: { label: string; types?: docs.Type[] }) => (
  <Show when={props.types?.length}>
    <div class="text-sm text-mute font-mono mt-2">
      <span class="text-accent">{props.label} </span>
      <For each={props.types!}>
        {(t, i) => (
          <>
            <Show when={i() > 0}>
              <span>, </span>
            </Show>
            <Type type={t} />
          </>
        )}
      </For>
    </div>
  </Show>
)

/** Single-line `<keyword> <name>` compact row used by class/interface/enum/module. */
const NamedRow = (props: { keyword: string; id: number; name: string; comment?: docs.Comment }) => {
  const display = useDisplay()
  return (
    <div class={rowClass(display)}>
      <div class="font-mono text-sm leading-relaxed">
        <span class="text-accent">{props.keyword} </span>
        <Type.NameLink id={props.id} name={props.name} class="font-semibold" />
      </div>
      <Comment comment={props.comment} />
    </div>
  )
}

export const DeclarationFunction = createSlot('declaration.function', (props) => {
  const display = useDisplay()
  return (
    <div class={rowClass(display, 'mt-5')}>
      <For each={props.decl.signatures}>
        {(sig) => <Type.Signature sig={sig} name={props.decl.name} id={props.decl.id} kind="function" />}
      </For>
    </div>
  )
})

export const DeclarationInterface = createSlot('declaration.interface', (props) => {
  const display = useDisplay()
  return (
    <Show
      when={display() === 'compact'}
      fallback={<ExtendsLine label="extends" types={props.decl.extends} />}
    >
      <NamedRow keyword="interface" id={props.decl.id} name={props.decl.name} comment={props.decl.comment} />
    </Show>
  )
})

export const DeclarationModule = createSlot('declaration.module', (props) => {
  const display = useDisplay()
  return (
    <Show
      when={display() === 'compact'}
      fallback={
        <Show when={props.decl?.childDecls?.length}>
          <Comment comment={props.decl.comment} />
          <DisplayProvider value={() => 'compact'}>
            <div class="mt-5">
              <For each={props.decl.childDecls}>{(child) => <Declaration decl={child} />}</For>
            </div>
          </DisplayProvider>
        </Show>
      }
    >
      <NamedRow
        keyword="module"
        id={props.decl.id}
        name={docs.displayNameOf(props.decl)}
        comment={props.decl.comment}
      />
    </Show>
  )
})

/**
 * TS `export namespace foo { ... }` block. In compact mode renders as a
 * one-line linked row (the namespace gets its own routable page); in full
 * mode walks `childDecls` like a module.
 */
export const DeclarationNamespace = createSlot('declaration.namespace', (props) => {
  const display = useDisplay()
  return (
    <Show
      when={display() === 'compact'}
      fallback={
        <Show when={props.decl?.childDecls?.length}>
          <Comment comment={props.decl.comment} />
          <DisplayProvider value={() => 'compact'}>
            <div class="mt-5">
              <For each={props.decl.childDecls}>{(child) => <Declaration decl={child} />}</For>
            </div>
          </DisplayProvider>
        </Show>
      }
    >
      <NamedRow keyword="namespace" id={props.decl.id} name={props.decl.name} comment={props.decl.comment} />
    </Show>
  )
})

/**
 * `export …` clause. Walks `names[]`, pairing each entry with its resolved
 * target. Three render shapes:
 *   - target is a `Module`              -> namespace-link row (e.g. `export * as foo from './x'`)
 *   - rename (`entry.name` differs)     -> alias row (`export <orig> as <alias>`)
 *   - same-name                          -> dispatch to `<Declaration>` for the target
 */
export const DeclarationExports = createSlot('declaration.exports', (props) => {
  return (
    <For each={props.decl.names}>
      {(entry, i) => {
        const target = () => props.decl.targets[i()]
        return (
          <Show when={target()}>
            {(t) => <ExportEntry entry={entry} target={t()} />}
          </Show>
        )
      }}
    </For>
  )
})

const ExportEntry = (props: { entry: { name: string; id: number }; target: docs.Declaration }) => {
  const display = useDisplay()
  if (props.target.kind === 'module') {
    return (
      <div class={rowClass(display)}>
        <div class="font-mono text-sm leading-relaxed">
          <span class="text-accent">namespace </span>
          <Type.NameLink id={props.target.id} name={props.entry.name} class="font-semibold" />
          <span class="text-mute"> — </span>
          <span class="text-mute">{docs.displayNameOf(props.target)}</span>
        </div>
        <Comment comment={props.target.comment} />
      </div>
    )
  }
  const targetName = docs.nameOf(props.target)
  if (targetName && targetName !== props.entry.name) {
    return (
      <div class={rowClass(display)}>
        <div class="font-mono text-sm leading-relaxed">
          <span class="text-accent">export </span>
          <Type.NameLink id={props.target.id} name={props.entry.name} class="font-semibold" />
          <span class="text-mute"> = </span>
          <span class="text-mute">{targetName}</span>
        </div>
      </div>
    )
  }
  return <Declaration decl={props.target} />
}

export const DeclarationTypeAlias = createSlot('declaration.type-alias', (props) => {
  const display = useDisplay()
  return (
    <div class={rowClass(display)}>
      <div class="font-mono text-sm leading-relaxed">
        <span class="text-accent">type </span>
        <Type.NameLink id={props.decl.id} name={props.decl.name} class="font-semibold" />
        <Show when={props.decl.typeParameters?.length}>
          <span class="text-mute">{'<'}</span>
          <For each={props.decl.typeParameters!}>
            {(tp, i) => (
              <>
                <Show when={i() > 0}>
                  <span class="text-mute">, </span>
                </Show>
                <span>{tp.name}</span>
                <Show when={tp.constraint}>
                  <>
                    <span class="text-accent"> extends </span>
                    <Type type={tp.constraint!} />
                  </>
                </Show>
              </>
            )}
          </For>
          <span class="text-mute">{'>'}</span>
        </Show>
        <span class="text-mute"> = </span>
        <Type type={props.decl.type} />
      </div>
      <Comment comment={props.decl.comment} />
    </div>
  )
})

export const DeclarationVariable = createSlot('declaration.variable', (props) => {
  const display = useDisplay()
  return (
    <div class={rowClass(display)}>
      <div class="font-mono text-sm leading-relaxed">
        <span class="text-accent">const </span>
        <Type.NameLink id={props.decl.id} name={props.decl.name} class="font-semibold" />
        <span class="text-mute">: </span>
        <Type type={props.decl.type} />
        <Show when={props.decl.defaultValue}>
          <span class="text-mute"> = {props.decl.defaultValue}</span>
        </Show>
      </div>
      <Comment comment={props.decl.comment} />
    </div>
  )
})

const RENDERERS: Record<docs.Declaration['kind'], Component<{ decl: any }>> = {
  class: DeclarationClass,
  interface: DeclarationInterface,
  enum: DeclarationEnum,
  function: DeclarationFunction,
  variable: DeclarationVariable,
  'type-alias': DeclarationTypeAlias,
  module: DeclarationModule,
  namespace: DeclarationNamespace,
  exports: DeclarationExports,
}
