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
        <Show when={props.decl?.children?.length}>
          <Comment comment={props.decl.comment} />
          <DisplayProvider value={() => 'compact'}>
            <div class="mt-5">
              <For each={props.decl.children}>{(child) => <Declaration decl={child} />}</For>
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
 * Re-export rendering, picked per syntactic form:
 *   - `named`     — list each re-exported target as if declared locally.
 *   - `namespace` — `export * as foo from '…'` — render a single linked
 *                   row pointing at the source module. The alias gives the
 *                   re-export its own identity so it is never flattened.
 *   - `all`       — `export * from '…'` — inline the source module's
 *                   children, matching TS semantics.
 *
 * The form is fixed per declaration instance so a plain branch is safe;
 * each For-row in the parent module hands us a fresh instance when the
 * surrounding decl changes.
 */
export const DeclarationReExport = createSlot('declaration.re-export', (props) => {
  const re = props.decl
  if (re.form === 'named') return <NamedReExportList decl={re} />
  if (re.form === 'namespace') {
    const src = re.sourceModuleRef
    if (!src) return null
    return <NamespaceLinkRow as={re.as} mod={src} />
  }
  return <Show when={re.sourceModuleRef}>{(s) => <InlineModuleChildren mod={s() as docs.Module} />}</Show>
})

/**
 * `export { a, b as c } from 'x'` — render each target inline. The slot
 * dispatch handles the per-target kind, so a re-exported function still
 * uses the function row layout.
 */
const NamedReExportList = (props: { decl: docs.ReExportNamed }) => {
  const display = useDisplay()
  return (
    <For each={props.decl.named}>
      {(entry) => {
        const target = () => props.decl.targets.find((t) => docs.nameOf(t) === entry.name)
        return (
          <Show when={target()}>
            {(t) => (
              <Show when={entry.as && entry.as !== entry.name} fallback={<Declaration decl={t()} />}>
                <div class={rowClass(display)}>
                  <div class="font-mono text-sm leading-relaxed">
                    <span class="text-accent">export </span>
                    <Type.NameLink id={t().id} name={entry.as!} class="font-semibold" />
                    <span class="text-mute"> = </span>
                    <span class="text-mute">{entry.name}</span>
                  </div>
                </div>
              </Show>
            )}
          </Show>
        )
      }}
    </For>
  )
}

/** Compact link row for `export * as <as> from '<mod>'` pointing at a public module. */
const NamespaceLinkRow = (props: { as: string; mod: docs.Module }) => {
  const display = useDisplay()
  return (
    <div class={rowClass(display)}>
      <div class="font-mono text-sm leading-relaxed">
        <span class="text-accent">namespace </span>
        <Type.NameLink id={props.mod.id} name={props.as} class="font-semibold" />
        <span class="text-mute"> — </span>
        <span class="text-mute">{docs.displayNameOf(props.mod)}</span>
      </div>
      <Comment comment={props.mod.comment} />
    </div>
  )
}

/**
 * Inline a module's children at the current level — used to flatten
 * `export * from './x'` and namespace re-exports to internal-only modules.
 * No header, no comment; the surrounding module owns the heading.
 */
const InlineModuleChildren = (props: { mod: docs.Module }) => (
  <For each={props.mod.children}>{(child) => <Declaration decl={child} />}</For>
)

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
  're-export': DeclarationReExport,
}
