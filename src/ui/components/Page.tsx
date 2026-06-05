import { For, Show, createMemo, type Component } from 'solid-js'
import { Dynamic } from 'solid-js/web'

import { createSlot, DeclarationScope, useProject, type Types } from '../context/index.tsx'
import { type ReferenceRow, useReferences } from '../hooks/index.ts'
import { labelOf } from '../util/kind.ts'
import { commentSummaryText } from '../util/comment.ts'
import { docStatement } from '../util/route.ts'
import { A } from '../context/router.tsx'

import { Declaration } from './Declaration.tsx'
import { Breadcrumb } from './Breadcrumb.tsx'
import { Markdown } from './Markdown.tsx'
import { Type } from './Type.tsx'

/** A page renders its route's `body` parts in order, each by its kind. */
export const Page = createSlot('page', (props) => (
  <article>
    <For each={props.route.body}>{(body) => <PageContent route={props.route} body={body} />}</For>
  </article>
))

/** Dispatch a single `body` part to the renderer for its kind. */
export const PageContent = createSlot('page.content', (props) => (
  <Dynamic component={RENDERERS[props.body.kind] as Component<BodyProps>} route={props.route} body={props.body} />
))

type BodyProps<B extends Types.Body = Types.Body> = { route: Types.Route; body: B }

const RENDERERS: { [K in Types.Body['kind']]: Component<BodyProps<Extract<Types.Body, { kind: K }>>> } = {
  'doc:statement': (props) => <DocStatementView body={props.body} route={props.route} />,
  'doc:referenced': (props) => <References route={props.route} />,
  markdown: (props) => <Markdown source={props.body.markdown} />,
}

/** A declaration body: header, the declaration itself, and its members. */
const DocStatementView = (props: BodyProps<Types.DocStatement>) => {
  const project = useProject()
  const decl = createMemo(() => project().byId(props.body.id))
  return (
    <Show when={decl()}>
      {(d) => (
        <DeclarationScope id={d().id}>
          <PageHeader decl={d()} route={props.route} />
          <Declaration decl={d()} />
          <Children id={props.body.id} />
        </DeclarationScope>
      )}
    </Show>
  )
}

export const PageHeader = createSlot('page.header', (props: { decl: Types.Declaration; route: Types.Route }) => (
  <header class="mb-5">
    <Breadcrumb id={props.decl.id} />
    <div class="flex items-baseline gap-3 flex-wrap">
      <h1 class="text-2xl font-semibold tracking-tight font-mono">{props.route.title}</h1>
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

/**
 * Member listing for a declaration page: the route's children grouped by kind,
 * exactly as the router lays them out. Each group becomes a titled section.
 */
const Children = (props: { id: number }) => {
  const project = useProject()
  const groups = createMemo(() => project().routes.members(props.id))
  return (
    <For each={groups()}>
      {(group) => (
        <section class="mt-8">
          <Show when={group.group}>
            <h2 class="text-sm font-semibold mb-3 pb-1.5 border-b border-line capitalize">{group.group}</h2>
          </Show>
          <ul class="space-y-3">
            <For each={group.items}>{(m) => <ChildRow route={m.route} />}</For>
          </ul>
        </section>
      )}
    </For>
  )
}

const ChildRow = (props: { route: Types.Route }) => {
  const project = useProject()
  const decl = () => {
    const stmt = docStatement(props.route)
    return stmt ? project().byId(stmt.id) : undefined
  }
  const summary = () => commentSummaryText(decl()?.comment)
  return (
    <li>
      <div class="flex items-baseline gap-2.5 min-w-0">
        <Type.KindBadge kind={decl()?.kind ?? 'module'} class="w-3.5 shrink-0" />
        <A href={props.route.slug} class="font-mono font-semibold text-sm hover:opacity-70">
          {props.route.title}
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

/** "Used in" backlinks for the route's declaration. */
export const References = (props: { route: Types.Route }) => {
  const id = createMemo(() => docStatement(props.route)?.id ?? -1)
  const rows = useReferences(id)
  return (
    <Show when={rows().length}>
      <section class="mt-10 lk-references">
        <h2 class="font-semibold text-xl mb-4 pb-2 border-b border-line">Referenced In</h2>
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
    <A href={props.row.slug} class="font-mono hover:opacity-70 min-w-0 wrap-break-word">
      <Show when={props.row.module}>
        <span class="text-mute">{props.row.module}.</span>
      </Show>
      <span class="font-medium">{props.row.name}</span>
    </A>
  </li>
)
