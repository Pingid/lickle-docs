import { For, Show, createMemo } from 'solid-js'
import { A } from '@solidjs/router'

import { createSlot, useProject, type Types } from '../context/index.ts'
import { type ReferenceRow, useReferences } from '../hooks/index.ts'
import { labelOf, pluralLabel, groupOrder } from '../util/kind.ts'
import { commentSummaryText } from '../util/comment.ts'

import { Declaration } from './Declaration.tsx'
import { Breadcrumb } from './Breadcrumb.tsx'
import { Markdown } from './Markdown.tsx'
import { Type } from './Type.tsx'

type PageProps = { decl: Types.Declaration; route: Types.RouteNode<'declaration' | 'module'> }

export const Page = createSlot('page', (props) => (
  <article>
    <PageHeader {...props} />
    <Declaration decl={props.decl} />
    <Children route={props.route} />
    <References id={props.decl.id} />
  </article>
))

/** Renders a markdown page — its `content` parsed inline. */
export const MarkdownPage = createSlot('page.markdown', (props) => (
  <article>
    <Markdown source={props.route.page.content} />
  </article>
))

export const PageHeader = createSlot('page.header', (props: PageProps) => (
  <header class="mb-5">
    <Breadcrumb id={props.decl.id} />
    <div class="flex items-baseline gap-3 flex-wrap">
      <h1 class="text-2xl font-semibold tracking-tight font-mono">{props.route.label}</h1>
      <Type.KindLabel kind={props.decl.kind} />
      <Show when={props.decl.comment?.tags?.some((t: { tag: string }) => t.tag === '@deprecated')}>
        <span class="text-xs uppercase tracking-wider text-mute">· deprecated</span>
      </Show>
    </div>
    <Source sources={props.decl.sources} />
  </header>
))

/** Stock source-location renderer. Replaceable via `slots.source`. */
export const Source = createSlot('page.source', (props: { sources?: Types.Source[] }) => (
  <Show when={props.sources?.[0]}>
    {(s) => (
      <div class="text-xs text-mute mt-2">
        <span class="font-mono">
          {s().module}:{s().line}
        </span>
      </div>
    )}
  </Show>
))

type ChildRoute = Types.RouteNode<'declaration' | 'module'>
type ChildRow = { route: ChildRoute; decl?: Types.Declaration; kind: string; summary: string }

/** Child pages of a module / namespace, grouped by kind and linked from the route tree. */
const Children = (props: { route: ChildRoute }) => {
  const project = useProject()
  const groups = createMemo(() => groupChildren(project(), props.route.children))
  return (
    <For each={groups()}>
      {(group) => (
        <section class="mt-8">
          <h2 class="text-sm font-semibold mb-3 pb-1.5 border-b border-line capitalize">{group.title}</h2>
          <ul class="space-y-3">
            <For each={group.items}>{(row) => <ChildRowView row={row} />}</For>
          </ul>
        </section>
      )}
    </For>
  )
}

const ChildRowView = (props: { row: ChildRow }) => (
  <li>
    <div class="flex items-baseline gap-2.5 min-w-0">
      <Type.KindBadge kind={props.row.kind} class="w-3.5 shrink-0" />
      <A href={`/${props.row.route.slug}`} class="font-mono font-semibold text-sm hover:opacity-70">
        {props.row.route.label}
      </A>
      <Show when={props.row.decl}>{(d) => <Signature decl={d()} />}</Show>
    </div>
    <Show when={props.row.summary}>
      <p class="text-sm text-mute mt-1 pl-6 line-clamp-2">{props.row.summary}</p>
    </Show>
  </li>
)

/** A terse inline type cue next to a member name (function params / variable type). */
const Signature = (props: { decl: Types.Declaration }) => {
  const d = props.decl
  if (d.kind === 'function' && d.signatures[0])
    return (
      <span class="font-mono text-sm text-mute min-w-0 truncate">
        <Type.SignatureExpr sig={d.signatures[0]} />
      </span>
    )
  if (d.kind === 'variable')
    return (
      <span class="font-mono text-sm text-mute min-w-0 truncate">
        : <Type type={d.type} />
      </span>
    )
  return null
}

/** Bucket child routes by declaration kind, ordered by the canonical group order. */
const groupChildren = (project: Types.Project, children: ChildRoute[]): { title: string; items: ChildRow[] }[] => {
  const buckets = new Map<string, ChildRow[]>()
  for (const route of children) {
    const decl = project.byId(route.page.id)
    const kind = decl?.kind ?? 'module'
    const title = pluralLabel(kind)
    const arr = buckets.get(title) ?? []
    arr.push({ route, decl, kind, summary: commentSummaryText(decl?.comment) })
    buckets.set(title, arr)
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => groupOrder(a) - groupOrder(b) || a.localeCompare(b))
    .map(([title, items]) => ({ title, items: items.sort((a, b) => a.route.label.localeCompare(b.route.label)) }))
}

export const References = createSlot('page.references', (props: { id: number }) => {
  const rows = useReferences(() => props.id)

  return (
    <Show when={rows().length}>
      <section class="mt-10 lk-references">
        <h2 class="font-semibold text-xl mb-4 pb-2 border-b border-line">Used in</h2>
        <ul class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 items-baseline">
          <For each={rows()}>{(r) => <ReferenceRowView row={r} />}</For>
        </ul>
      </section>
    </Show>
  )
})

const ReferenceRowView = (props: { row: ReferenceRow }) => (
  <li class="contents">
    <span class="text-xs uppercase tracking-wider text-mute">{labelOf(props.row.decl.kind)}</span>
    <A href={`/${props.row.slug}`} class="font-mono hover:opacity-70 min-w-0 wrap-break-word">
      <Show when={props.row.module}>
        <span class="text-mute">{props.row.module}.</span>
      </Show>
      <span class="font-medium">{props.row.name}</span>
    </A>
  </li>
)
