import { For, Show } from 'solid-js'

import { createSlot, useProject, type Types } from '../context/index.tsx'
import { type ReferenceRow, useReferences } from '../hooks/index.ts'
import { labelOf } from '../util/kind.ts'
import { commentSummaryText } from '../util/comment.ts'
import { A } from '../context/router.tsx'

import { Declaration } from './Declaration.tsx'
import { Breadcrumb } from './Breadcrumb.tsx'
import { Markdown } from './Markdown.tsx'
import { Type } from './Type.tsx'

type PageProps = { decl: Types.Declaration; route: Types.RouteNode<'doc'> }

export const Page = createSlot('page.doc', (props) => (
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
    <Markdown source={props.route.page?.content ?? ''} />
  </article>
))

export const PageHeader = createSlot('page.doc.header', (props: PageProps) => (
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
export const Source = (props: { sources?: Types.Source[] }) => {
  const project = useProject()
  return (
    <Show when={props.sources?.[0]}>
      {(s) => {
        const link = project().sourceLink(s())
        const text = `${s().file}:${s().line}`
        if (link) {
          return (
            <a href={link} class="text-xs text-mute mt-2 font-mono">
              {text}
            </a>
          )
        }
        return <div class="text-xs text-mute mt-2 font-mono">{text}</div>
      }}
    </Show>
  )
}

type ChildRoute = Types.RouteNode<'doc'>

/**
 * Render a route's children exactly as the provider laid them out: synthetic
 * group nodes (no page) become titled sections, ungrouped doc routes render
 * inline. No re-grouping — the route tree already carries labels and order.
 */
const Children = (props: { route: ChildRoute }) => (
  <For each={props.route.children}>
    {(child) => (
      <Show
        when={child.page === undefined}
        fallback={
          <ul class="space-y-3 mt-8">
            <ChildRow route={child as ChildRoute} />
          </ul>
        }
      >
        <section class="mt-8">
          <h2 class="text-sm font-semibold mb-3 pb-1.5 border-b border-line capitalize">{child.label}</h2>
          <ul class="space-y-3">
            <For each={child.children}>{(c) => <ChildRow route={c as ChildRoute} />}</For>
          </ul>
        </section>
      </Show>
    )}
  </For>
)

const ChildRow = (props: { route: ChildRoute }) => {
  const project = useProject()
  const decl = () => (props.route.page ? project().byId(props.route.page.id) : undefined)
  const summary = () => commentSummaryText(decl()?.comment)
  return (
    <li>
      <div class="flex items-baseline gap-2.5 min-w-0">
        <Type.KindBadge kind={decl()?.kind ?? 'module'} class="w-3.5 shrink-0" />
        <A href={`/${props.route.slug ?? ''}`} class="font-mono font-semibold text-sm hover:opacity-70">
          {props.route.label}
        </A>
        <Show when={decl()}>{(d) => <Signature decl={d()} />}</Show>
      </div>
      <Show when={summary()}>
        <p class="text-sm text-mute mt-1 pl-6 line-clamp-2">{summary()}</p>
      </Show>
    </li>
  )
}

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

export const References = (props: { id: number }) => {
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
}

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
