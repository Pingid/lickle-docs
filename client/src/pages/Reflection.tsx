import { For, Show, createMemo, type Component } from 'solid-js'
import { useParams, A } from '@solidjs/router'
import type { JSONOutput } from 'typedoc'
import { Dynamic } from 'solid-js/web'

import { Kind, effectiveKind, labelOf, signaturesOf } from '../util/kind.js'
import { Comment, ReflectionScope } from '../components/Comment.js'
import { References } from '../components/References.js'
import { Breadcrumb } from '../components/Breadcrumb.js'
import { Signature } from '../components/Signature.js'
import { Members } from '../components/Members.js'
import { useIndex } from '../context/index.js'
import { Type } from '../components/Type.js'

type Decl = JSONOutput.DeclarationReflection
type SomeType = JSONOutput.SomeType

const Source = (props: { sources?: JSONOutput.SourceReference[] }) => (
  <Show when={props.sources?.[0]}>
    {(s) => (
      <div class="text-xs text-mute mt-2">
        <Show
          when={s().url}
          fallback={
            <span class="font-mono">
              {s().fileName}:{s().line}
            </span>
          }
        >
          <a href={s().url} target="_blank" rel="noreferrer" class="font-mono hover:text-fg">
            {s().fileName}:{s().line}
          </a>
        </Show>
      </div>
    )}
  </Show>
)

const Header = (props: { decl: Decl }) => (
  <header class="mb-5">
    <Breadcrumb id={props.decl.id} />
    <div class="flex items-baseline gap-3 flex-wrap">
      <h1 class="text-2xl font-semibold tracking-tight font-mono">{props.decl.name}</h1>
      <span class="text-xs uppercase tracking-wider text-mute">{labelOf(effectiveKind(props.decl))}</span>
      <Show when={props.decl.comment?.blockTags?.some((t) => t.tag === '@deprecated')}>
        <span class="text-xs uppercase tracking-wider text-mute">· deprecated</span>
      </Show>
    </div>
    <Source sources={props.decl.sources} />
  </header>
)

const FunctionPage = (props: { decl: Decl }) => (
  <article>
    <Header decl={props.decl} />
    <Show when={props.decl.comment}>
      <Comment comment={props.decl.comment} />
    </Show>
    <div class="mt-5">
      <For each={signaturesOf<JSONOutput.SignatureReflection>(props.decl)}>
        {(sig) => <Signature sig={sig} name={props.decl.name} kind="function" />}
      </For>
    </div>
  </article>
)

const VariablePage = (props: { decl: Decl }) => (
  <article>
    <Header decl={props.decl} />
    <Show when={props.decl.type}>
      <div class="font-mono text-sm leading-relaxed py-2">
        <span class="text-accent">const </span>
        <span class="font-semibold">{props.decl.name}</span>
        <span class="text-mute">: </span>
        <Type type={props.decl.type as SomeType} />
        <Show when={props.decl.defaultValue}>
          <span class="text-mute"> = {props.decl.defaultValue}</span>
        </Show>
      </div>
    </Show>
    <Show when={props.decl.comment}>
      <div class="mt-5">
        <Comment comment={props.decl.comment} />
      </div>
    </Show>
  </article>
)

const TypeAliasPage = (props: { decl: Decl }) => (
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
              <Show when={tp.type}>
                <>
                  <span class="text-accent"> extends </span>
                  <Type type={tp.type as SomeType} />
                </>
              </Show>
            </>
          )}
        </For>
        <span class="text-mute">{'>'}</span>
      </Show>
      <span class="text-mute"> = </span>
      <Show when={props.decl.type}>
        <Type type={props.decl.type as SomeType} />
      </Show>
    </div>
    <Show when={props.decl.comment}>
      <div class="mt-5">
        <Comment comment={props.decl.comment} />
      </div>
    </Show>
  </article>
)

const ClassOrInterfacePage = (props: { decl: Decl }) => (
  <article>
    <Header decl={props.decl} />
    <Show when={props.decl.extendedTypes?.length}>
      <div class="text-sm text-mute font-mono mt-2">
        <span class="text-accent">extends </span>
        <For each={props.decl.extendedTypes!}>
          {(t, i) => (
            <>
              <Show when={i() > 0}>
                <span>, </span>
              </Show>
              <Type type={t as SomeType} />
            </>
          )}
        </For>
      </div>
    </Show>
    <Show when={props.decl.implementedTypes?.length}>
      <div class="text-sm text-mute font-mono mt-1">
        <span class="text-accent">implements </span>
        <For each={props.decl.implementedTypes!}>
          {(t, i) => (
            <>
              <Show when={i() > 0}>
                <span>, </span>
              </Show>
              <Type type={t as SomeType} />
            </>
          )}
        </For>
      </div>
    </Show>
    <Show when={props.decl.comment}>
      <div class="mt-5">
        <Comment comment={props.decl.comment} />
      </div>
    </Show>
    <Members decl={props.decl} />
  </article>
)

const EnumPage = (props: { decl: Decl }) => (
  <article>
    <Header decl={props.decl} />
    <Show when={props.decl.comment}>
      <Comment comment={props.decl.comment} />
    </Show>
    <section class="mt-8">
      <h2 class="font-semibold text-xl mb-4 pb-2 border-b border-line">Members</h2>
      <For each={props.decl.children ?? []}>
        {(m) => (
          <div class="border-b border-line py-3 last:border-b-0">
            <div class="flex items-baseline gap-3 flex-wrap">
              <code class="font-mono font-semibold">{m.name}</code>
              <Show when={m.defaultValue}>
                <code class="font-mono text-mute text-sm">= {m.defaultValue}</code>
              </Show>
            </div>
            <Show when={m.comment}>
              <div class="mt-1 text-sm">
                <Comment comment={m.comment} />
              </div>
            </Show>
          </div>
        )}
      </For>
    </section>
  </article>
)

const ModulePage = (props: { decl: Decl }) => (
  <article>
    <Header decl={props.decl} />
    <Show when={props.decl.comment}>
      <Comment comment={props.decl.comment} />
    </Show>
    <Members decl={props.decl} />
  </article>
)

/** Map effective kind → page component. Falls back to {@link ModulePage}. */
const pageFor = (k: number): Component<{ decl: Decl }> => {
  if (k === Kind.Function) return FunctionPage
  if (k === Kind.Variable) return VariablePage
  if (k === Kind.TypeAlias) return TypeAliasPage
  if (k === Kind.Class || k === Kind.Interface) return ClassOrInterfacePage
  if (k === Kind.Enum) return EnumPage
  return ModulePage
}

export const Reflection = () => {
  const params = useParams()
  const idx = useIndex()

  const decl = createMemo<Decl | undefined>(() => {
    const slug = params.slug
    if (!slug) return undefined
    const id = idx.idBySlug.get(slug)
    if (id == null) return undefined
    const r = idx.byId.get(id)
    return r as Decl | undefined
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
