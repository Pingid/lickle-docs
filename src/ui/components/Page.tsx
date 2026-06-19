import { For, Match, Show, Switch, createMemo, type Component } from 'solid-js'

import { createSlot, type Reflect } from '../context/index.tsx'
import { DocRouter, useProject } from '../hooks/index.ts'
import { commentSummaryText } from '../util/comment.ts'
import { staticComponent } from '../util/solid.tsx'
import { labelOf } from '../util/kind.ts'
import { A } from '../util/router.tsx'

import { CopyPageButton } from './CopyPage.tsx'
import { Declaration } from './Declaration.tsx'
import { Breadcrumb } from './Breadcrumb.tsx'
import { Markdown } from './Markdown.tsx'
import * as Type from './Type.tsx'

/**
 * A doc route renders its declaration (header + body), its member links and its
 * "referenced in" backlinks; a markdown page renders each `body` string as prose.
 */
export const Page = createSlot('page', (props) => {
  return (
    <article class="relative">
      <div class="w-full flex justify-end">
        <CopyPageButton route={props.route} />
      </div>
      <Switch>
        <Match when={props.route.kind === 'doc' && props.route}>
          {(route) => (
            <>
              <Statement route={route()} />
              <InlineMembers members={route().inline} />
              <Links links={route().links} />
              <References referenced={route().referenced} />
            </>
          )}
        </Match>
        <Match when={props.route.kind === 'page' && props.route}>
          {(route) => <For each={route().body}>{(md) => <Markdown source={md} />}</For>}
        </Match>
      </Switch>
    </article>
  )
})

/** A declaration page: header, the declaration itself, and its members. */
const Statement = (props: { route: DocRouter.DocPage }) => {
  const project = useProject()
  const decl = createMemo(() => project()?.byId(props.route.decl))
  return (
    <Show when={decl()}>
      {(d) => (
        <>
          <PageHeader decl={d()} route={props.route} />
          <Declaration decl={d()} />
        </>
      )}
    </Show>
  )
}

/**
 * Title block of a declaration page: breadcrumb, name, kind label, a
 * deprecation marker when `@deprecated` is present, and the source link.
 * Replaceable via the `page.header` slot.
 */
export const PageHeader = createSlot(
  'page.header',
  (props: { decl: Reflect.Declaration; route: DocRouter.PageNode }) => (
    <header class="mb-5">
      <Breadcrumb id={props.decl.id} />
      <div class="flex items-baseline gap-3 flex-wrap">
        <h1 class="text-2xl font-semibold tracking-tight font-mono">{props.route.title}</h1>
        <Type.KindLabel kind={props.decl.kind} />
        <Show when={props.decl.comment?.tags?.some((t: { tag: string }) => t.tag === '@deprecated')}>
          <span class="text-xs uppercase tracking-wider text-mute">· deprecated</span>
        </Show>
      </div>
      <Source decl={props.decl} />
    </header>
  ),
)

/** Stock source-location renderer. Replaceable via `slots.source`. */
export const Source: Component<{ decl: Reflect.Declaration }> = staticComponent((props) => {
  const project = useProject()
  const sources = createMemo(() => {
    return (props.decl.sources ?? []).map((s) => ({
      link: project()?.sourceLink(s),
      text: props.decl.kind === 'module' ? `${s.file}` : `${s.file}:${s.line}`,
    }))
  })
  return (
    <For each={sources()}>
      {(s) => (
        <>
          <Show when={s.link}>
            {(link) => (
              <a href={link()} class="text-xs text-mute mt-2 font-mono">
                {s.text}
              </a>
            )}
          </Show>
          <Show when={!s.link}>
            <div class="text-xs text-mute mt-2 font-mono">{s.text}</div>
          </Show>
        </>
      )}
    </For>
  )
})

/**
 * Members rendered inline on the parent page (full docs), before the link list
 * — the route's `render: 'inline'` children, which have no page of their own.
 */
const InlineMembers = (props: { members?: DocRouter.DocLink[] }) => {
  const project = useProject()
  const groups = createMemo(() => DocRouter.groupItems(props.members ?? [], (m) => m.group))
  return (
    <For each={groups()}>
      {(group) => (
        <>
          <Show when={group.group}>
            <h2 class="text-sm font-semibold mt-8 mb-3 pb-1.5 border-b border-line capitalize">{group.group}</h2>
          </Show>
          <For each={group.items}>
            {(m) => {
              const decl = createMemo(() => project()?.byId(m.target))
              return (
                <Show when={decl()}>
                  {(d) => (
                    <section class="mt-8">
                      <div class="flex items-baseline gap-3 flex-wrap mb-2">
                        <h2 class="text-lg font-semibold font-mono">{m.alias}</h2>
                        <Type.KindLabel kind={d().kind} />
                      </div>
                      <Declaration decl={d()} />
                    </section>
                  )}
                </Show>
              )
            }}
          </For>
        </>
      )}
    </For>
  )
}

/**
 * Member listing for a declaration page: the route's children grouped by kind,
 * exactly as the router lays them out. Each group becomes a titled section.
 */
const Links = (props: { links: DocRouter.DocLink[] }) => {
  const groups = createMemo(() => DocRouter.groupItems(props.links, (l) => l.group))
  return (
    <For each={groups()}>
      {(group) => (
        <section class="mt-8">
          <Show when={group.group}>
            <h2 class="text-sm font-semibold mb-3 pb-1.5 border-b border-line capitalize">{group.group}</h2>
          </Show>
          <ul class="space-y-3">
            <For each={group.items}>{(l) => <LinkRow link={l} />}</For>
          </ul>
        </section>
      )}
    </For>
  )
}

const LinkRow = (props: { link: DocRouter.DocLink }) => {
  const project = useProject()
  const router = DocRouter.use()
  const route = () => {
    const route = router()?.get({ id: props.link.target })
    const decl = project()?.byId(props.link.target)
    if (!decl || !route) return undefined
    return { route, decl }
  }
  const summary = () => commentSummaryText(route()?.decl?.comment)
  return (
    <Show when={route()}>
      {(r) => (
        <li>
          <div class="flex items-baseline gap-2.5 min-w-0">
            <Type.KindBadge kind={r().decl.kind} class="w-3.5 shrink-0" />
            <A href={r().route.slug} class="font-mono font-semibold text-sm hover:opacity-70">
              {props.link.alias}
            </A>
            <Show when={r().decl}>{(d) => <Signature decl={d()} />}</Show>
          </div>
          <Show when={summary()}>
            <p class="text-sm text-mute mt-1 pl-6 line-clamp-2">{summary()}</p>
          </Show>
        </li>
      )}
    </Show>
  )
}

/** A terse inline type cue next to a member name (function params / variable type). */
const Signature = (props: { decl: Reflect.Declaration }) => {
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
        : <Type.Type type={d.type} />
      </span>
    )
  return null
}

/**
 * "Referenced In" backlinks from the route's `referenced` refs, grouped and
 * ordered with the same {@link groupItems} the sidebar and member lists use.
 */
export const References: Component<{ referenced: DocRouter.DocLink[] }> = staticComponent((props) => {
  const groups = createMemo(() => DocRouter.groupItems(props.referenced, (r) => r.group))
  return (
    <Show when={props.referenced.length}>
      <section class="mt-10 lk-references">
        <h2 class="font-semibold text-xl mb-4 pb-2 border-b border-line">Referenced In</h2>
        <For each={groups()}>
          {(group) => (
            <div class="mb-5">
              <Show when={group.group}>
                <h3 class="text-sm font-semibold mb-2 capitalize text-mute">{group.group}</h3>
              </Show>
              <ul class="grid grid-cols-[max-content_1fr_max-content] gap-x-4 gap-y-1.5 items-baseline">
                <For each={group.items}>{(typeRef) => <ReferenceRow typeRef={typeRef} />}</For>
              </ul>
            </div>
          )}
        </For>
      </section>
    </Show>
  )
})

const ReferenceRow = (props: { typeRef: DocRouter.DocLink }) => {
  const project = useProject()
  const router = DocRouter.use()
  const route = () => router()?.get({ id: props.typeRef.target })
  const decl = () => project()?.byId(props.typeRef.target)
  const qualified = () => props.typeRef.alias || route()?.title || ''
  const dot = () => qualified().lastIndexOf('.')
  const source = () => decl()?.sources?.[0]

  return (
    <Show when={route() && decl()}>
      <li class="contents">
        <span class="text-xs tracking-wider text-mute">{labelOf(decl()!.kind)}</span>
        <A href={route()!.slug} class="font-mono hover:opacity-70 min-w-0 wrap-break-word">
          <Show when={dot() >= 0}>
            <span class="text-mute">{qualified().slice(0, dot())}.</span>
          </Show>
          <span class="font-medium">{dot() < 0 ? qualified() : qualified().slice(dot() + 1)}</span>
        </A>
        {/* Like the header's source line, but clicking navigates to the reference's page. */}
        <Show when={source()} fallback={<span />}>
          {(s) => (
            <A
              href={route()!.slug}
              class="font-mono text-[0.7rem] text-mute hover:text-fg whitespace-nowrap text-right"
            >
              {s().file}:{s().line}
            </A>
          )}
        </Show>
      </li>
    </Show>
  )
}
