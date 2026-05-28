import { For, Show } from 'solid-js'

import * as docs from '../../core/client.ts'

import { createSlot, DisplayProvider } from '../context/index.ts'
import { Type } from './Type.tsx'
import { Comment } from './Comment.tsx'

export const Declaration = createSlot('declaration', (props) => {
  if (props.decl.kind === 'class') return <DeclarationClass decl={props.decl} />
  if (props.decl.kind === 'interface') return <DeclarationInterface decl={props.decl} />
  if (props.decl.kind === 'enum') return <DeclarationEnum decl={props.decl} />
  if (props.decl.kind === 'function') return <DeclarationFunction decl={props.decl} />
  if (props.decl.kind === 'variable') return <DeclarationVariable decl={props.decl} />
  if (props.decl.kind === 'type-alias') return <DeclarationTypeAlias decl={props.decl} />
  if (props.decl.kind === 'module') return <DeclarationModule decl={props.decl} />
  if (props.decl.kind === 're-export') return <DeclarationReExport decl={props.decl} />
  let n: never = props.decl
  void n
  return null
})

export const DeclarationClass = createSlot('declaration.class', (props) => (
  <>
    <Show when={props.decl.extends?.length}>
      <div class="text-sm text-mute font-mono mt-2">
        <span class="text-accent">extends </span>
        <For each={props.decl.extends!}>
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
    <Show when={props.decl.implements?.length}>
      <div class="text-sm text-mute font-mono mt-1">
        <span class="text-accent">implements </span>
        <For each={props.decl.implements!}>
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
  </>
))

export const DeclarationEnum = createSlot('declaration.enum', (props) => `TODO ${props.decl.kind}`)

export const DeclarationFunction = createSlot('declaration.function', (props) => (
  <div class="mt-5">
    <For each={props.decl.signatures}>
      {(sig) => <Type.Signature sig={sig} name={props.decl.name} kind="function" />}
    </For>
  </div>
))

export const DeclarationInterface = createSlot('declaration.interface', (props) => (
  <Show when={props.decl.extends?.length}>
    <div class="text-sm text-mute font-mono mt-2">
      <span class="text-accent">extends </span>
      <For each={props.decl.extends!}>
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
))

export const DeclarationModule = createSlot('declaration.module', (props) => (
  <Show when={props.decl?.children?.length}>
    <Comment comment={props.decl.comment} />
    <DisplayProvider value={() => 'compact'}>
      <For each={props.decl.children}>{(child) => <Declaration decl={child} />}</For>
    </DisplayProvider>
  </Show>
))

export const DeclarationReExport = createSlot('declaration.re-export', (props) => {
  return (
    <Show when={props.decl.sourceModuleRef}>
      {(c) => (
        <div>
          <h2 class="font-semibold text-xl mb-4 pb-2 border-b border-line">{docs.nameOf(c())}</h2>
          <For each={c().children}>{(child) => <>{docs.nameOf(child)}</>}</For>
        </div>
      )}
    </Show>
  )
})

export const DeclarationTypeAlias = createSlot('declaration.type-alias', (props) => (
  <div class="font-mono text-sm leading-relaxed py-2">
    <span class="text-accent">type </span>
    <span class="font-semibold">{props.decl.name}</span>
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
))

export const DeclarationVariable = createSlot('declaration.variable', (props) => (
  <div class="font-mono text-sm leading-relaxed py-2">
    <span class="text-accent">const </span>
    <span class="font-semibold">{props.decl.name}</span>
    <span class="text-mute">: </span>
    <Type type={props.decl.type} />
    <Show when={props.decl.defaultValue}>
      <span class="text-mute"> = {props.decl.defaultValue}</span>
    </Show>
  </div>
))
