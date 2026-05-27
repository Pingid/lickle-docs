import { For, Show, createMemo, type Component } from 'solid-js'
import { useParams, A } from '@solidjs/router'
import type * as docs from '@lickle/docs'
import { Dynamic } from 'solid-js/web'

import { effectiveKind, labelOf, signaturesOf, type Kind } from '../util/kind.js'
import { OldComment, ReflectionScope } from '../components/Comment.js'
import { References } from '../components/References.js'
import { Breadcrumb } from '../components/Breadcrumb.js'
import { Signature } from '../components/Signature.js'
import { Members } from '../components/Members.js'
import { useProject } from '../context/index.js'
import { Type } from '../components/Type.js'

type Decl = docs.Declaration

const Source = (props: { sources?: docs.Source[] }) => (
  <Show when={props.sources?.[0]}>
    {(s) => (
      <div class="text-xs text-mute mt-2">
        <span class="font-mono">
          {s().file}:{s().line}
        </span>
      </div>
    )}
  </Show>
)

const Header = (props: { decl: Decl }) => (
  <header class="mb-5">
    <Breadcrumb id={props.decl.id} />
    <div class="flex items-baseline gap-3 flex-wrap">
      <h1 class="text-2xl font-semibold tracking-tight font-mono">{nameOf(props.decl)}</h1>
      <span class="text-xs uppercase tracking-wider text-mute">{labelOf(effectiveKind(props.decl))}</span>
      <Show when={props.decl.comment?.tags.some((t: { tag: string }) => t.tag === '@deprecated')}>
        <span class="text-xs uppercase tracking-wider text-mute">· deprecated</span>
      </Show>
    </div>
    <Source sources={props.decl.sources} />
  </header>
)

const nameOf = (decl: Decl): string => (decl as { name?: string }).name ?? '<anonymous>'

const FunctionPage = (props: { decl: docs.Declaration<'function'> | docs.Declaration<'variable'> }) => (
  <article>
    <Header decl={props.decl} />
    {/* The function decl's comment is repeated on each signature, so
        skip it here and let `<Signature>` render the per-overload copy. */}
    <div class="mt-5">
      <For each={signaturesOf(props.decl)}>
        {(sig) => <Signature sig={sig} name={props.decl.name} kind="function" />}
      </For>
    </div>
  </article>
)

const VariablePage = (props: { decl: docs.Declaration<'variable'> }) => (
  <article>
    <Header decl={props.decl} />
    <div class="font-mono text-sm leading-relaxed py-2">
      <span class="text-accent">const </span>
      <span class="font-semibold">{props.decl.name}</span>
      <span class="text-mute">: </span>
      <Type type={props.decl.type} />
      <Show when={props.decl.defaultValue}>
        <span class="text-mute"> = {props.decl.defaultValue}</span>
      </Show>
    </div>
    <Show when={props.decl.comment}>
      <div class="mt-5">
        <OldComment comment={props.decl.comment} />
      </div>
    </Show>
  </article>
)

const TypeAliasPage = (props: { decl: docs.Declaration<'type-alias'> }) => (
  <article>
    <Header decl={props.decl} />
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
    <Show when={props.decl.comment}>
      <div class="mt-5">
        <OldComment comment={props.decl.comment} />
      </div>
    </Show>
  </article>
)

const ClassPage = (props: { decl: docs.Declaration<'class'> }) => (
  <article>
    <Header decl={props.decl} />
    <Show when={props.decl.extends}>
      <div class="text-sm text-mute font-mono mt-2">
        <span class="text-accent">extends </span>
        <Type type={props.decl.extends!} />
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
    <Show when={props.decl.comment}>
      <div class="mt-5">
        <OldComment comment={props.decl.comment} />
      </div>
    </Show>
    <Members decl={props.decl} />
  </article>
)

const InterfacePage = (props: { decl: docs.Declaration<'interface'> }) => (
  <article>
    <Header decl={props.decl} />
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
    <Show when={props.decl.comment}>
      <div class="mt-5">
        <OldComment comment={props.decl.comment} />
      </div>
    </Show>
    <Members decl={props.decl} />
  </article>
)

const EnumPage = (props: { decl: docs.Declaration<'enum'> }) => (
  <article>
    <Header decl={props.decl} />
    <Show when={props.decl.comment}>
      <OldComment comment={props.decl.comment} />
    </Show>
    <section class="mt-8">
      <h2 class="font-semibold text-xl mb-4 pb-2 border-b border-line">Members</h2>
      <For each={props.decl.members}>
        {(m) => (
          <div class="border-b border-line py-3 last:border-b-0">
            <div class="flex items-baseline gap-3 flex-wrap">
              <code class="font-mono font-semibold">{m.name}</code>
              <Show when={m.value != null}>
                <code class="font-mono text-mute text-sm">= {String(m.value)}</code>
              </Show>
            </div>
            <Show when={m.comment}>
              <div class="mt-1 text-sm">
                <OldComment comment={m.comment} />
              </div>
            </Show>
          </div>
        )}
      </For>
    </section>
  </article>
)

const ModulePage = (props: { decl: docs.Declaration<'module'> }) => (
  <article>
    <Header decl={props.decl} />
    <Show when={props.decl.comment}>
      <OldComment comment={props.decl.comment} />
    </Show>
    <Members decl={props.decl} />
  </article>
)

/** Map effective kind → page component. Falls back to {@link ModulePage}. */
const pageFor = (k: Kind): Component<{ decl: any }> => {
  if (k === 'function') return FunctionPage
  if (k === 'variable') return VariablePage
  if (k === 'type-alias') return TypeAliasPage
  if (k === 'class') return ClassPage
  if (k === 'interface') return InterfacePage
  if (k === 'enum') return EnumPage
  return ModulePage
}

export const Reflection = () => {
  const params = useParams()
  const { project, idBySlug } = useProject()

  const decl = createMemo<Decl | undefined>(() => {
    const slug = params.slug
    if (!slug) return undefined
    const id = idBySlug.get(slug)
    if (id == null) return undefined
    return project.declarationsById.get(id)
  })

  return (
    <Show
      when={decl()}
      fallback={
        <div class="py-20 text-center">
          <h1 class="text-2xl font-semibold mb-2">Not found</h1>
          <p class="text-mute">No declaration matches this URL.</p>
          <A href="/" class="inline-block mt-4 underline">
            Back home
          </A>
        </div>
      }
    >
      {(d) => (
        <ReflectionScope id={d().id}>
          <Dynamic component={pageFor(effectiveKind(d()))} decl={d()} />
          <References id={d().id} />
        </ReflectionScope>
      )}
    </Show>
  )
}
