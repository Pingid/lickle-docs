import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import * as docs from '../../core/client.ts'

import { ReferenceRow, useReferences } from '../hooks/index.ts'
import { createSlot } from '../context/index.ts'
import { labelOf } from '../util/kind.ts'

import { Declaration } from './Decleration.tsx'
import { Breadcrumb } from './Breadcrumb.tsx'
import { Type } from './Type.tsx'

export const Page = createSlot('page', (props) => (
  <article>
    <PageHeader decl={props.decl} />
    <Declaration decl={props.decl} />
    <Members decl={props.decl} />
  </article>
))

export const PageHeader = createSlot('page.header', (props: { decl: docs.Declaration }) => (
  <header class="mb-5">
    <Breadcrumb id={props.decl.id} />
    <div class="flex items-baseline gap-3 flex-wrap">
      <h1 class="text-2xl font-semibold tracking-tight font-mono">{docs.displayNameOf(props.decl)}</h1>
      <Type.KindLabel kind={props.decl.kind} />
      <Show when={props.decl.comment?.tags?.some((t: { tag: string }) => t.tag === '@deprecated')}>
        <span class="text-xs uppercase tracking-wider text-mute">· deprecated</span>
      </Show>
    </div>
    <Source sources={props.decl.sources} />
  </header>
))

/** Stock source-location renderer. Replaceable via `slots.source`. */
export const Source = createSlot('page.source', (props: { sources?: docs.Source[] }) => (
  <Show when={props.sources?.[0]}>
    {(s) => (
      <div class="text-xs text-mute mt-2">
        <span class="font-mono">
          {s().file}:{s().line}
        </span>
      </div>
    )}
  </Show>
))

export const References = createSlot('page.references', (props: { id: number }) => {
  const rows = useReferences(() => props.id)

  return (
    <Show when={rows().length}>
      <section class="mt-10 lk-references">
        <h2 class="font-semibold text-xl mb-4 pb-2 border-b border-line">Used in</h2>
        <ul>
          <For each={rows()}>{(r) => <ReferenceRowView row={r} />}</For>
        </ul>
      </section>
    </Show>
  )
})

const ReferenceRowView = (props: { row: ReferenceRow }) => (
  <li>
    <span class="kind">{labelOf(props.row.decl.kind)}</span>
    <A href={`/r/${props.row.slug}`} class="symbol font-mono hover:opacity-70">
      <Show when={props.row.module}>
        <span class="text-mute">{props.row.module}.</span>
      </Show>
      <span class="font-medium">{props.row.name}</span>
    </A>
    <span class="summary">{props.row.summary}</span>
  </li>
)

const Members = (_props: { decl: docs.Declaration }) => {
  return <></>
  // const { sections } = useComponents()
  // const final = (): ChildSection[] => {
  //   const defaults = defaultFor(props.decl)
  //   const hook = sections?.[props.decl.kind as keyof MemberSections]
  //   return hook ? hook(props.decl as any, defaults) : defaults
  // }
  // return (
  //   <For each={final()}>
  //     {(s) => (
  //       <section class="mt-8">
  //         <h2 class="font-semibold text-xl mb-3 pb-1.5 border-b border-line capitalize">{s.title}</h2>
  //         <div>{s.render(s.items)}</div>
  //       </section>
  //     )}
  //   </For>
  // )
}
