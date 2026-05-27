import type { JSX } from 'solid-js/jsx-runtime'
import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import type * as docs from '../../core/client.ts'

import { ReflectionScope } from '../context/project.js'
import { useSlugFor } from '../hooks/index.js'
import { groupOrder, pluralLabel, type Kind } from '../util/kind.js'
import { isNamespaceReExport } from '../strategies/index.js'
import { SignatureExpr, Type } from '../primitives/Type.js'
import { KindBadge } from '../primitives/Kind.js'
import { Comment } from '../shared/Comment.js'
import { useComponents } from '../registry/context.js'
import type { ChildSection, MemberSections } from '../registry/types.js'

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Default member-section builder. Dispatches per parent kind; returns the
 * stock list users can post-process via `components.sections.<kind>`.
 */
export const defaultFor = (decl: docs.Declaration): ChildSection[] => {
  if (decl.kind === 'module') return moduleSections(decl)
  if (decl.kind === 'class') return classSections(decl)
  if (decl.kind === 'interface') return interfaceSections(decl)
  if (decl.kind === 'enum') return enumSections(decl)
  return []
}

/**
 * Page-level member rendering. Computes the stock section list, then hands
 * it to the user override (if any) for filtering / addition / replacement
 * before rendering.
 */
export const Members = (props: { decl: docs.Declaration }) => {
  const { sections } = useComponents()
  const final = (): ChildSection[] => {
    const defaults = defaultFor(props.decl)
    const hook = sections?.[props.decl.kind as keyof MemberSections]
    return hook ? hook(props.decl as any, defaults) : defaults
  }
  return (
    <For each={final()}>
      {(s) => (
        <section class="mt-8">
          <h2 class="font-semibold text-xl mb-3 pb-1.5 border-b border-line capitalize">{s.title}</h2>
          <div>{s.render(s.items)}</div>
        </section>
      )}
    </For>
  )
}

// ============================================================================
// MODULE SECTIONS
// Namespace re-exports (`export * as foo from './x'`) become a `Modules`
// section linking to the source module page; barrel re-exports
// (`export * from './x'`) are flattened so `re.targets` show alongside the
// module's own declarations.
// ============================================================================

const moduleSections = (mod: docs.Module): ChildSection[] => {
  const buckets = new Map<string, MemberEntry[]>()
  const push = (title: string, entry: MemberEntry) => {
    const arr = buckets.get(title) ?? []
    arr.push(entry)
    buckets.set(title, arr)
  }

  for (const c of mod.children) {
    if (c.kind === 're-export') {
      if (isNamespaceReExport(c) && c.sourceModuleRef) {
        push(pluralLabel('module'), { kind: 'module', re: c })
        continue
      }
      for (const t of c.targets) push(pluralLabel(t.kind), { kind: 'decl', decl: t })
      continue
    }
    push(pluralLabel(c.kind), { kind: 'decl', decl: c })
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => groupOrder(a) - groupOrder(b) || a.localeCompare(b))
    .map(([title, entries]): ChildSection => {
      const declItems = entries.flatMap((it) => (it.kind === 'decl' ? [it.decl] : []))
      const entryById = new Map(entries.flatMap((it) => (it.kind === 'decl' ? [[it.decl.id, it] as const] : [])))
      return {
        title,
        items: declItems,
        render: (items) => {
          // Keep the namespace-alias rows pinned at the front; for the rest,
          // honour whatever filtering/reordering the override did to `items`.
          const aliases = entries.filter((it) => it.kind === 'module')
          const declEntries = items.flatMap((d) => {
            const e = entryById.get(d.id)
            return e ? [e] : []
          })
          return (
            <For each={[...aliases, ...declEntries]}>{(it) => <MemberEntryRow entry={it} parentKind="module" />}</For>
          )
        },
      }
    })
}

type MemberEntry = { kind: 'decl'; decl: docs.Declaration } | { kind: 'module'; re: docs.ReExportNamespace }

const MemberEntryRow = (props: { entry: MemberEntry; parentKind: ParentKind }) => {
  const e = props.entry
  if (e.kind === 'module') return <ModuleAliasRow re={e.re} />
  return <MemberCard decl={e.decl} parentKind={props.parentKind} />
}

/** Row for a `export * as foo from './x'` — links to the source module page. */
const ModuleAliasRow = (props: { re: docs.ReExportNamespace }) => {
  const slugs = useSlugFor()
  const target = props.re.sourceModuleRef
  const slug = target ? slugs.byId(target.id) : undefined
  return (
    <div class="border-b border-line py-3 last:border-b-0">
      <div class="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2 font-mono text-sm leading-relaxed">
        <KindBadge kind="module" />
        <div class="min-w-0">
          <Show when={slug} fallback={<span class="font-semibold">{props.re.as}</span>}>
            <A href={`/r/${slug}`} class="font-semibold hover:opacity-70">
              {props.re.as}
            </A>
          </Show>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// CLASS SECTIONS
// ============================================================================

const classSections = (cls: docs.Class): ChildSection[] => {
  const out: ChildSection[] = []
  if (cls.constructors.length) {
    out.push({
      title: 'Constructors',
      items: [],
      render: () => (
        <For each={cls.constructors}>{(s) => <SignatureRow sig={s} name={cls.name} kind="constructor" />}</For>
      ),
    })
  }
  if (cls.properties.length) {
    out.push(memberSection('Properties', cls.properties, 'class'))
  }
  if (cls.methods.length) {
    out.push(memberSection('Methods', cls.methods, 'class'))
  }
  if (cls.indexSignature) {
    out.push({ title: 'Index signature', items: [], render: () => <IndexSigRow sig={cls.indexSignature!} /> })
  }
  return out
}

// ============================================================================
// INTERFACE SECTIONS
// ============================================================================

const interfaceSections = (iface: docs.Interface): ChildSection[] => {
  const out: ChildSection[] = []
  if (iface.properties.length) {
    out.push(memberSection('Properties', iface.properties, 'interface'))
  }
  if (iface.methods.length) {
    out.push(memberSection('Methods', iface.methods, 'interface'))
  }
  if (iface.callSignatures?.length) {
    out.push({
      title: 'Call signatures',
      items: [],
      render: () => <For each={iface.callSignatures!}>{(s) => <SignatureRow sig={s} />}</For>,
    })
  }
  if (iface.constructSignatures?.length) {
    out.push({
      title: 'Construct signatures',
      items: [],
      render: () => <For each={iface.constructSignatures!}>{(s) => <SignatureRow sig={s} kind="constructor" />}</For>,
    })
  }
  if (iface.indexSignature) {
    out.push({ title: 'Index signature', items: [], render: () => <IndexSigRow sig={iface.indexSignature!} /> })
  }
  return out
}

// ============================================================================
// ENUM SECTIONS
// EnumPage renders members directly today; expose a section here too so
// `components.sections.enum` overrides land somewhere predictable.
// ============================================================================

const enumSections = (e: docs.Enum): ChildSection[] => {
  if (!e.members.length) return []
  const byId = new Map(e.members.map((m) => [m.id, m] as const))
  return [
    {
      title: 'Members',
      items: e.members as unknown as docs.Declaration[],
      render: (items) => {
        const rows = items.flatMap((d) => {
          const m = byId.get(d.id)
          return m ? [m] : []
        })
        return (
          <For each={rows}>
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
                    <Comment comment={m.comment} />
                  </div>
                </Show>
              </div>
            )}
          </For>
        )
      },
    },
  ]
}

// ============================================================================
// SHARED ROW COMPONENTS
// ============================================================================

type ChildLike = docs.Declaration | docs.Property | docs.Method | docs.EnumMember
type ParentKind = 'module' | 'class' | 'interface'

/**
 * Build a `Properties` / `Methods` section whose `items` is the source list
 * coerced to `Declaration[]` for the registry contract; `render` keeps the
 * original objects via an id lookup so overrides that filter `items` work.
 */
const memberSection = <T extends { id: number }>(
  title: string,
  source: readonly T[],
  parentKind: ParentKind,
): ChildSection => {
  const byId = new Map(source.map((m) => [m.id, m] as const))
  return {
    title,
    items: source as unknown as docs.Declaration[],
    render: (items) => {
      const rows = items.flatMap((d) => {
        const m = byId.get(d.id)
        return m ? [m as unknown as ChildLike] : []
      })
      return <For each={rows}>{(m) => <MemberCard decl={m} parentKind={parentKind} />}</For>
    },
  }
}

const MemberCard = (props: { decl: ChildLike; parentKind: ParentKind }) => {
  const slugs = useSlugFor()
  const c = props.decl
  const k: Kind = c.kind as Kind
  const slug = slugs.byId(c.id)
  const name = 'name' in c ? (c.name ?? '') : ''

  const Name = () => (
    <Show when={slug} fallback={<span class="font-semibold">{name}</span>}>
      <A href={`/r/${slug}`} class="font-semibold hover:opacity-70">
        {name}
      </A>
    </Show>
  )

  const body = (): JSX.Element => {
    if (c.kind === 'property' || c.kind === 'variable') {
      const t = (c as docs.Property | docs.Variable).type
      const def = (c as docs.Property | docs.Variable).defaultValue
      return (
        <>
          <Name />
          <span class="text-mute">: </span>
          <Type type={t} />
          <Show when={def}>
            <span class="text-mute"> = {def}</span>
          </Show>
        </>
      )
    }
    if (c.kind === 'enum-member') {
      const v = (c as docs.EnumMember).value
      return (
        <>
          <Name />
          <Show when={v != null}>
            <span class="text-mute"> = {String(v)}</span>
          </Show>
        </>
      )
    }
    if (c.kind === 'method' || c.kind === 'function') {
      const sigs = (c as docs.Method | docs.Func).signatures
      return (
        <For each={sigs}>
          {(sig) => (
            <div>
              <Name />
              <SignatureExpr sig={sig} />
            </div>
          )}
        </For>
      )
    }
    if (c.kind === 'type-alias') {
      return (
        <>
          <Name />
          <span class="text-mute"> = </span>
          <Type type={(c as docs.TypeAlias).type} />
        </>
      )
    }
    return <Name />
  }

  return (
    <ReflectionScope id={c.id}>
      <div class="border-b border-line py-3 last:border-b-0">
        <div class="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2 font-mono text-sm leading-relaxed">
          <KindBadge kind={k} />
          <div class="min-w-0">{body()}</div>
        </div>
      </div>
    </ReflectionScope>
  )
}

const SignatureRow = (props: { sig: docs.Signature; name?: string; kind?: 'function' | 'method' | 'constructor' }) => (
  <ReflectionScope id={props.sig.id}>
    <div class="border-b border-line py-3 last:border-b-0 font-mono text-sm leading-relaxed">
      <Show when={props.kind === 'constructor'}>
        <span class="text-accent">new </span>
      </Show>
      <Show when={props.name}>
        <span class="font-semibold">{props.name}</span>
      </Show>
      <SignatureExpr sig={props.sig} />
    </div>
  </ReflectionScope>
)

const IndexSigRow = (props: { sig: docs.IndexSignature }) => (
  <div class="border-b border-line py-3 last:border-b-0 font-mono text-sm leading-relaxed">
    <span class="text-mute">[</span>
    <span class="font-semibold">{props.sig.parameter.name}</span>
    <span class="text-mute">: </span>
    <Type type={props.sig.parameter.type} />
    <span class="text-mute">]: </span>
    <Type type={props.sig.type} />
  </div>
)
