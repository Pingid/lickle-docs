import type { JSONOutput } from 'typedoc'
import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import { Kind, effectiveKind, groupOrder, labelOf, shortOf, signaturesOf } from '../util/kind.js'
import { SignatureExpr, Type } from './Type.js'
import { ReflectionScope } from './Comment.js'
import { useIndex } from '../context/index.js'

type Decl = JSONOutput.DeclarationReflection
type SomeType = JSONOutput.SomeType

type Group = { title: string; ids: number[] }

const sortGroups = (gs: Group[]): Group[] =>
  gs.sort((a, b) => groupOrder(a.title) - groupOrder(b.title) || a.title.localeCompare(b.title))

const groupChildren = (decl: Decl): Group[] => {
  if (decl.categories?.length) {
    return sortGroups(
      decl.categories.map((c) => ({ title: c.title, ids: c.children ?? [] })).filter((g) => g.ids.length),
    )
  }
  // Bucket by `effectiveKind` rather than typedoc's `decl.groups`. TypeDoc
  // groups callable consts (`const f = () => ...`) as Variables; our effective
  // kind promotes them to Function so they land in the right section.
  const buckets = new Map<string, number[]>()
  for (const c of decl.children ?? []) {
    const key = pluralOf(effectiveKind(c))
    const arr = buckets.get(key) ?? []
    arr.push(c.id)
    buckets.set(key, arr)
  }
  return sortGroups([...buckets.entries()].map(([title, ids]) => ({ title, ids })))
}

const pluralOf = (kind: number) => {
  const l = labelOf(kind)
  if (l.endsWith('s')) return l
  if (l === 'class') return 'classes'
  if (l === 'property') return 'properties'
  return l + 's'
}

const MemberCard = (props: { decl: Decl }) => {
  const idx = useIndex()
  const c = props.decl
  const k = effectiveKind(c)
  const slug = idx.slugById.get(c.id)

  const Name = () => (
    <Show when={slug} fallback={<span class="font-semibold">{c.name}</span>}>
      <A href={`/r/${slug}`} class="font-semibold hover:opacity-70">
        {c.name}
      </A>
    </Show>
  )

  const body = () => {
    if (k === Kind.Property || k === Kind.Variable || k === Kind.EnumMember) {
      return (
        <>
          <Name />
          <Show when={c.type}>
            <>
              <span class="text-mute">: </span>
              <Type type={c.type as SomeType} />
            </>
          </Show>
          <Show when={c.defaultValue}>
            <span class="text-mute"> = {c.defaultValue}</span>
          </Show>
        </>
      )
    }
    if (k === Kind.Method || k === Kind.Function || k === Kind.Constructor) {
      return (
        <For each={signaturesOf<JSONOutput.SignatureReflection>(c)}>
          {(sig) => (
            <div>
              <Show when={c.kind === Kind.Constructor}>
                <span class="text-accent">new </span>
              </Show>
              <Name />
              <SignatureExpr sig={sig} />
            </div>
          )}
        </For>
      )
    }
    if (k === Kind.TypeAlias) {
      return (
        <>
          <Name />
          <span class="text-mute"> = </span>
          <Type type={c.type as SomeType} />
        </>
      )
    }
    return <Name />
  }

  return (
    <ReflectionScope id={c.id}>
      <div class="border-b border-line py-3 last:border-b-0">
        <div class="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2 font-mono text-sm leading-relaxed">
          <span class="text-xs text-mute text-center" title={labelOf(k)}>
            {shortOf(k)}
          </span>
          <div class="min-w-0">{body()}</div>
        </div>
      </div>
    </ReflectionScope>
  )
}

export const Members = (props: { decl: Decl }) => {
  const idx = useIndex()
  const groups = () => groupChildren(props.decl)

  return (
    <For each={groups()}>
      {(g) => {
        const decls = g.ids
          .map((id) => idx.byId.get(id))
          .filter((r): r is Decl => !!r && (r as Decl).kind !== undefined)
        if (!decls.length) return null
        return (
          <section class="mt-8">
            <h2 class="font-semibold text-xl mb-3 pb-1.5 border-b border-line capitalize">{g.title}</h2>
            <div>
              <For each={decls}>{(d) => <MemberCard decl={d} />}</For>
            </div>
          </section>
        )
      }}
    </For>
  )
}
