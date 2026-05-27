import type { JSX } from 'solid-js/jsx-runtime'
import type * as docs from '@lickle/docs'
import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import { ReflectionScope } from '../context/project.js'
import { groupOrder, labelOf, pluralLabel, shortOf, type Kind } from '../util/kind.js'
import { isNamespaceReExport } from '../util/project.js'
import { SignatureExpr, Type } from './Type.js'
import { useProject } from '../context/index.js'

type ChildSection = { title: string; render: () => JSX.Element }

/**
 * Page-level member rendering. Dispatches per parent kind:
 * - Module: bucket children by `kind` and render with {@link MemberCard}.
 * - Class:  fixed sections — Constructors, Properties, Methods.
 * - Interface: Properties, Methods, Call signatures, Construct signatures, Index signature.
 */
export const Members = (props: { decl: docs.Declaration }) => {
  const sections = () => sectionsFor(props.decl)
  return (
    <For each={sections()}>
      {(s) => {
        const body = s.render()
        if (body == null) return null
        return (
          <section class="mt-8">
            <h2 class="font-semibold text-xl mb-3 pb-1.5 border-b border-line capitalize">{s.title}</h2>
            <div>{body}</div>
          </section>
        )
      }}
    </For>
  )
}

const sectionsFor = (decl: docs.Declaration): ChildSection[] => {
  if (decl.kind === 'module') return moduleSections(decl)
  if (decl.kind === 'class') return classSections(decl)
  if (decl.kind === 'interface') return interfaceSections(decl)
  return []
}

/**
 * Module children, bucketed by kind. Re-exports flatten depending on `form`:
 *   - `namespace` → `Modules` row that links to the source module page
 *   - `all` / `named` → expand `re.targets` so they sit alongside local decls
 */
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
    .map(([title, items]) => ({
      title,
      render: () => <For each={items}>{(it) => <MemberEntryRow entry={it} parentKind="module" />}</For>,
    }))
}

type MemberEntry = { kind: 'decl'; decl: docs.Declaration } | { kind: 'module'; re: docs.ReExportNamespace }

const MemberEntryRow = (props: { entry: MemberEntry; parentKind: ParentKind }) => {
  const e = props.entry
  if (e.kind === 'module') return <ModuleAliasRow re={e.re} />
  return <MemberCard decl={e.decl} parentKind={props.parentKind} />
}

/** Row for a `export * as foo from './x'` — links to the source module page. */
const ModuleAliasRow = (props: { re: docs.ReExportNamespace }) => {
  const { project } = useProject()
  const target = props.re.sourceModuleRef
  const slug = target ? project.slugById.get(target.id) : undefined
  return (
    <div class="border-b border-line py-3 last:border-b-0">
      <div class="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2 font-mono text-sm leading-relaxed">
        <span class="text-xs text-mute text-center" title={labelOf('module')}>
          {shortOf('module')}
        </span>
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

const classSections = (cls: docs.Class): ChildSection[] => {
  const out: ChildSection[] = []
  if (cls.constructors.length) {
    out.push({
      title: 'Constructors',
      render: () => (
        <For each={cls.constructors}>{(s) => <SignatureRow sig={s} name={cls.name} kind="constructor" />}</For>
      ),
    })
  }
  if (cls.properties.length) {
    out.push({
      title: 'Properties',
      render: () => <For each={cls.properties}>{(p) => <MemberCard decl={p} parentKind="class" />}</For>,
    })
  }
  if (cls.methods.length) {
    out.push({
      title: 'Methods',
      render: () => <For each={cls.methods}>{(m) => <MemberCard decl={m} parentKind="class" />}</For>,
    })
  }
  if (cls.indexSignature) {
    out.push({ title: 'Index signature', render: () => <IndexSigRow sig={cls.indexSignature!} /> })
  }
  return out
}

const interfaceSections = (iface: docs.Interface): ChildSection[] => {
  const out: ChildSection[] = []
  if (iface.properties.length) {
    out.push({
      title: 'Properties',
      render: () => <For each={iface.properties}>{(p) => <MemberCard decl={p} parentKind="interface" />}</For>,
    })
  }
  if (iface.methods.length) {
    out.push({
      title: 'Methods',
      render: () => <For each={iface.methods}>{(m) => <MemberCard decl={m} parentKind="interface" />}</For>,
    })
  }
  if (iface.callSignatures?.length) {
    out.push({
      title: 'Call signatures',
      render: () => <For each={iface.callSignatures!}>{(s) => <SignatureRow sig={s} />}</For>,
    })
  }
  if (iface.constructSignatures?.length) {
    out.push({
      title: 'Construct signatures',
      render: () => <For each={iface.constructSignatures!}>{(s) => <SignatureRow sig={s} kind="constructor" />}</For>,
    })
  }
  if (iface.indexSignature) {
    out.push({ title: 'Index signature', render: () => <IndexSigRow sig={iface.indexSignature!} /> })
  }
  return out
}

type ChildLike = docs.Declaration | docs.Property | docs.Method | docs.EnumMember
type ParentKind = 'module' | 'class' | 'interface'

/**
 * Single-row card for a child declaration. Dispatches the body by kind, with
 * a small parent-context tweak for class methods.
 */
const MemberCard = (props: { decl: ChildLike; parentKind: ParentKind }) => {
  const { project } = useProject()
  const c = props.decl as ChildLike & { id: number; name?: string; kind: string }
  const k: Kind = c.kind as Kind
  const slug = project.slugById.get(c.id)

  const Name = () => (
    <Show when={slug} fallback={<span class="font-semibold">{c.name}</span>}>
      <A href={`/r/${slug}`} class="font-semibold hover:opacity-70">
        {c.name}
      </A>
    </Show>
  )

  const body = () => {
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
          <span class="text-xs text-mute text-center" title={labelOf(k)}>
            {shortOf(k)}
          </span>
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
