import { For, Show, createMemo, type Component } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { A } from '../context/router.tsx'

import { type Types } from '../context/index.tsx'

import { type Kind, labelOf, shortOf } from '../util/kind.ts'
import { useSlugFor } from '../hooks/index.ts'

import { Markdown } from './Markdown.tsx'
import { Comment } from './Comment.tsx'
import { Syntax } from './Syntax.tsx'
import { Link } from './Link.tsx'

type T = Types.Type

/**
 * Render an arbitrary type. The body re-evaluates when `props.type` changes
 * so that navigating between pages with different type shapes swaps the
 * sub-renderer instead of freezing on the original branch (a classic Solid
 * pitfall where a top-level `switch` in a component runs only on mount).
 */
export const Type = (props: { type: T | undefined }) => {
  const renderer = createMemo(() => (props.type ? (RENDERERS[props.type.kind] ?? Type.Unknown) : null))
  return (
    <Show when={props.type && renderer()}>
      {(r) => <Dynamic component={r() as Component<{ type: T }>} type={props.type!} />}
    </Show>
  )
}

// --- Variant renderers (one per `Types.Type['kind']`, ordered to match RENDERERS) ---

Type.Intrinsic = (props: { type: Types.Type<'intrinsic'> }) => <Syntax.Kw>{props.type.name}</Syntax.Kw>

Type.Literal = (props: { type: Types.Type<'literal'> }) => {
  const t = props.type
  if (typeof t.value === 'string') return <span class="text-fg">"{t.value}"</span>
  if (t.value === null) return <Syntax.Kw>null</Syntax.Kw>
  return <span>{String(t.value)}</span>
}

Type.Reference = (props: { type: Types.Type<'reference'> }) => {
  const t = props.type
  return (
    <>
      <Link.Type
        id={t.type === 'internal' ? t.targetId : undefined}
        name={t.name}
        external={t.type === 'external' ? t.external : undefined}
      />
      <Type.TypeArgs args={t.args} />
    </>
  )
}

Type.Record = (props: { type: Types.Type<'record'> }) => {
  const decl = props.type
  const onlySignatures =
    decl.callSignatures?.length === 1 &&
    !decl.properties.length &&
    !decl.methods?.length &&
    !decl.indexSignature &&
    !decl.constructSignatures?.length
  if (onlySignatures) return <Type.SignatureExpr sig={decl.callSignatures![0]!} arrow />

  // Every member kind, flattened to renderers so a single `<For>` lays them
  // out with consistent `; ` separators.
  const members = (): (() => any)[] => [
    ...decl.properties.map((p) => () => <RecordProperty prop={p} />),
    ...(decl.methods ?? []).flatMap((m) => m.signatures.map((sig) => () => <RecordMethod name={m.name} sig={sig} />)),
    ...(decl.indexSignature ? [() => <RecordIndex sig={decl.indexSignature!} />] : []),
    ...(decl.callSignatures ?? []).map((sig) => () => <Type.SignatureExpr sig={sig} />),
    ...(decl.constructSignatures ?? []).map((sig) => () => (
      <>
        <Syntax.Kw>new </Syntax.Kw>
        <Type.SignatureExpr sig={sig} />
      </>
    )),
  ]

  return (
    <Show when={members().length} fallback={<Syntax.Punct>{'{}'}</Syntax.Punct>}>
      <Syntax.Punct>{'{ '}</Syntax.Punct>
      <For each={members()}>
        {(render, i) => (
          <>
            <Show when={i() > 0}>
              <Syntax.Punct>{'; '}</Syntax.Punct>
            </Show>
            {render()}
          </>
        )}
      </For>
      <Syntax.Punct>{' }'}</Syntax.Punct>
    </Show>
  )
}

/**
 * Conditional type. Right-nested chains (`A extends B ? X : C extends D ? …`)
 * are flattened and rendered as an aligned `: ` ladder, the way Prettier
 * formats long conditional-type maps, instead of one runaway inline line.
 */
Type.Conditional = (props: { type: Types.Type<'conditional'> }) => {
  const chain = createMemo(() => {
    const branches: Types.Type<'conditional'>[] = []
    let cur: Types.Type | undefined = props.type
    while (cur?.kind === 'conditional') {
      branches.push(cur)
      cur = cur.false
    }
    return { branches, tail: cur }
  })
  const head = (b: Types.Type<'conditional'>) => (
    <>
      <Type type={b.check} />
      <Syntax.Kw> extends </Syntax.Kw>
      <Type type={b.extends} />
      <Syntax.Punct> ? </Syntax.Punct>
      <Type type={b.true} />
    </>
  )
  return (
    <Show
      when={chain().branches.length > 1}
      fallback={
        <>
          {head(props.type)}
          <Syntax.Punct> : </Syntax.Punct>
          <Type type={props.type.false} />
        </>
      }
    >
      <span class="inline-flex flex-col align-top">
        <For each={chain().branches}>
          {(b, i) => (
            <span classList={{ 'pl-4': i() > 0 }}>
              <Show when={i() > 0}>
                <Syntax.Punct>: </Syntax.Punct>
              </Show>
              {head(b)}
            </span>
          )}
        </For>
        <span class="pl-4">
          <Syntax.Punct>: </Syntax.Punct>
          <Type type={chain().tail} />
        </span>
      </span>
    </Show>
  )
}

Type.Union = (props: { type: Types.Type<'union'> }) => <Type.Join sep=" | " items={props.type.types} />

Type.Intersection = (props: { type: Types.Type<'intersection'> }) => <Type.Join sep=" & " items={props.type.types} />

Type.Array = (props: { type: Types.Type<'array'> }) => (
  <>
    <Type type={props.type.elementType} />
    <Syntax.Punct>[]</Syntax.Punct>
  </>
)

Type.Tuple = (props: { type: Types.Type<'tuple'> }) => (
  <>
    <Syntax.Punct>[</Syntax.Punct>
    <For each={props.type.elements}>
      {(el, i) => (
        <>
          <Show when={i() > 0}>
            <Syntax.Punct>{', '}</Syntax.Punct>
          </Show>
          <TupleElement el={el} />
        </>
      )}
    </For>
    <Syntax.Punct>]</Syntax.Punct>
  </>
)

Type.FunctionType = (props: { type: Types.Type<'function-type'> }) => (
  <Show when={props.type.signatures[0]} fallback={<Syntax.Kw>function</Syntax.Kw>}>
    {(sig) => <Type.SignatureExpr sig={sig()} arrow />}
  </Show>
)

Type.TypeOperator = (props: { type: Types.Type<'type-operator'> }) => (
  <>
    <Syntax.Kw>{props.type.operator}</Syntax.Kw>
    <span> </span>
    <Type type={props.type.target} />
  </>
)

Type.Infer = (props: { type: Types.Type<'infer'> }) => (
  <>
    <Syntax.Kw>infer </Syntax.Kw>
    <Syntax.Name>{props.type.name}</Syntax.Name>
    <Show when={props.type.constraint}>
      <>
        <Syntax.Kw> extends </Syntax.Kw>
        <Type type={props.type.constraint!} />
      </>
    </Show>
  </>
)

Type.IndexedAccess = (props: { type: Types.Type<'indexed-access'> }) => (
  <>
    <Type type={props.type.object} />
    <Syntax.Punct>[</Syntax.Punct>
    <Type type={props.type.index} />
    <Syntax.Punct>]</Syntax.Punct>
  </>
)

Type.Mapped = (props: { type: Types.Type<'mapped'> }) => {
  const t = props.type
  return (
    <>
      <Syntax.Punct>{'{ '}</Syntax.Punct>
      <Show when={t.readonly}>
        <Syntax.Kw>readonly </Syntax.Kw>
      </Show>
      <Syntax.Punct>[</Syntax.Punct>
      <Syntax.Name>{t.typeParameter.name}</Syntax.Name>
      <Show when={t.typeParameter.constraint}>
        <>
          <Syntax.Kw> in </Syntax.Kw>
          <Type type={t.typeParameter.constraint!} />
        </>
      </Show>
      <Show when={t.nameType}>
        <>
          <Syntax.Kw> as </Syntax.Kw>
          <Type type={t.nameType!} />
        </>
      </Show>
      <Syntax.Punct>]</Syntax.Punct>
      <Show when={t.optional}>
        <Syntax.Punct>?</Syntax.Punct>
      </Show>
      <Syntax.Punct>: </Syntax.Punct>
      <Type type={t.type} />
      <Syntax.Punct>{' }'}</Syntax.Punct>
    </>
  )
}

Type.Query = (props: { type: Types.Type<'query'> }) => (
  <>
    <Syntax.Kw>typeof </Syntax.Kw>
    <Syntax.Name>{props.type.name}</Syntax.Name>
    <Type.TypeArgs args={props.type.args} />
  </>
)

Type.TemplateLiteral = (props: { type: Types.Type<'template-literal'> }) => (
  <>
    <span class="text-fg">
      {'`'}
      {props.type.head}
    </span>
    <For each={props.type.spans}>
      {(sp) => (
        <>
          <Syntax.Punct>{'${'}</Syntax.Punct>
          <Type type={sp.type} />
          <Syntax.Punct>{'}'}</Syntax.Punct>
          <span class="text-fg">{sp.literal}</span>
        </>
      )}
    </For>
    <span class="text-fg">{'`'}</span>
  </>
)

Type.Predicate = (props: { type: Types.Type<'predicate'> }) => (
  <>
    <Show when={props.type.asserts}>
      <Syntax.Kw>asserts </Syntax.Kw>
    </Show>
    <Syntax.Name>{props.type.parameter}</Syntax.Name>
    <Show when={props.type.type}>
      <>
        <Syntax.Kw> is </Syntax.Kw>
        <Type type={props.type.type!} />
      </>
    </Show>
  </>
)

Type.ImportType = (props: { type: Types.Type<'import-type'> }) => {
  const t = props.type
  return (
    <>
      <Show when={t.isTypeOf}>
        <Syntax.Kw>typeof </Syntax.Kw>
      </Show>
      <Syntax.Kw>import</Syntax.Kw>
      <Syntax.Punct>(</Syntax.Punct>
      <span class="text-fg">"{t.argument}"</span>
      <Syntax.Punct>)</Syntax.Punct>
      <Show when={t.qualifier}>
        <>
          <Syntax.Punct>.</Syntax.Punct>
          <Syntax.Name>{t.qualifier!}</Syntax.Name>
        </>
      </Show>
      <Type.TypeArgs args={t.args} />
    </>
  )
}

/** Catch-all: the parser's `unknown` kind, plus any runtime kind without a renderer. */
Type.Unknown = (props: { type: Types.Type }) => (
  <Syntax.Name>{(props.type as { text?: string; kind: string }).text ?? props.type.kind}</Syntax.Name>
)

const RENDERERS: { [K in Types.Type['kind']]: Component<{ type: Types.Type<K> }> } = {
  intrinsic: Type.Intrinsic,
  literal: Type.Literal,
  reference: Type.Reference,
  record: Type.Record,
  conditional: Type.Conditional,
  union: Type.Union,
  intersection: Type.Intersection,
  array: Type.Array,
  tuple: Type.Tuple,
  'function-type': Type.FunctionType,
  'type-operator': Type.TypeOperator,
  infer: Type.Infer,
  'indexed-access': Type.IndexedAccess,
  mapped: Type.Mapped,
  query: Type.Query,
  'template-literal': Type.TemplateLiteral,
  predicate: Type.Predicate,
  'import-type': Type.ImportType,
  unknown: Type.Unknown,
}

// --- Shared building blocks used by the variant renderers ---

Type.Join = (props: { sep: string; items: T[] }) => (
  <For each={props.items}>
    {(t, i) => (
      <>
        <Show when={i() > 0}>
          <Syntax.Punct>{props.sep}</Syntax.Punct>
        </Show>
        <Type type={t} />
      </>
    )}
  </For>
)

Type.TypeArgs = (props: { args?: T[] }) => (
  <Show when={props.args?.length}>
    <Syntax.Punct>{'<'}</Syntax.Punct>
    <Type.Join sep=", " items={props.args!} />
    <Syntax.Punct>{'>'}</Syntax.Punct>
  </Show>
)

const RecordProperty = (props: { prop: Types.Part<'property'> }) => (
  <>
    <Syntax.Name>{props.prop.name}</Syntax.Name>
    <Show when={props.prop.optional}>
      <Syntax.Punct>?</Syntax.Punct>
    </Show>
    <Syntax.Punct>: </Syntax.Punct>
    <Type type={props.prop.type} />
  </>
)

const RecordMethod = (props: { name: string; sig: Types.Part<'signature'> }) => (
  <>
    <Syntax.Name>{props.name}</Syntax.Name>
    <Type.SignatureExpr sig={props.sig} />
  </>
)

const RecordIndex = (props: { sig: Types.Part<'index-signature'> }) => (
  <>
    <Syntax.Punct>[</Syntax.Punct>
    <Syntax.Name>{props.sig.parameter.name}</Syntax.Name>
    <Syntax.Punct>: </Syntax.Punct>
    <Type type={props.sig.parameter.type} />
    <Syntax.Punct>]: </Syntax.Punct>
    <Type type={props.sig.type} />
  </>
)

const TupleElement = (props: { el: Types.Part<'tuple-element'> }) => (
  <>
    <Show when={props.el.rest}>
      <Syntax.Punct>...</Syntax.Punct>
    </Show>
    <Show when={props.el.name}>
      <>
        <Syntax.Name>{props.el.name!}</Syntax.Name>
        <Show when={props.el.optional}>
          <Syntax.Punct>?</Syntax.Punct>
        </Show>
        <Syntax.Punct>: </Syntax.Punct>
      </>
    </Show>
    <Type type={props.el.type} />
    <Show when={!props.el.name && props.el.optional}>
      <Syntax.Punct>?</Syntax.Punct>
    </Show>
  </>
)

Type.SignatureExpr = (props: { sig: Types.Part<'signature'>; arrow?: boolean }) => (
  <>
    <Type.Generics generics={props.sig.generics} />
    <Syntax.Punct>(</Syntax.Punct>
    <For each={props.sig.params}>
      {(p, i) => (
        <>
          <Show when={i() > 0}>
            <Syntax.Punct>{', '}</Syntax.Punct>
          </Show>
          <Show when={p.rest}>
            <Syntax.Punct>...</Syntax.Punct>
          </Show>
          <Syntax.Name>{p.name}</Syntax.Name>
          <Show when={p.optional || p.default != null}>
            <Syntax.Punct>?</Syntax.Punct>
          </Show>
          <Syntax.Punct>: </Syntax.Punct>
          <Type type={p.type} />
        </>
      )}
    </For>
    <Syntax.Punct>)</Syntax.Punct>
    <Syntax.Punct>{props.arrow ? ' => ' : ': '}</Syntax.Punct>
    <Type type={props.sig.return} />
  </>
)

/** Type parameter list — `<T extends C = D>`. */
Type.Generics = (props: { generics?: Types.Part<'generic'>[] }) => (
  <Show when={props.generics?.length}>
    <Syntax.Punct>{'<'}</Syntax.Punct>
    <For each={props.generics!}>
      {(tp, i) => (
        <>
          <Show when={i() > 0}>
            <Syntax.Punct>{', '}</Syntax.Punct>
          </Show>
          <Syntax.Name>{tp.name}</Syntax.Name>
          <Show when={tp.constraint}>
            <>
              <Syntax.Kw> extends </Syntax.Kw>
              <Type type={tp.constraint!} />
            </>
          </Show>
          <Show when={tp.default}>
            <>
              <Syntax.Punct> = </Syntax.Punct>
              <Type type={tp.default!} />
            </>
          </Show>
        </>
      )}
    </For>
    <Syntax.Punct>{'>'}</Syntax.Punct>
  </Show>
)

Type.TypeBlock = (props: { type: T | undefined }) => (
  <code class="font-mono text-[0.85em] leading-relaxed">
    <Type type={props.type} />
  </code>
)

Type.TypeBox = (props: { type: T | undefined; class?: string }) => (
  <div class={`codeblock ${props.class ?? ''}`}>
    <Type type={props.type} />
  </div>
)

Type.Inline = (props: { type?: Types.Type; text: string }) => (
  <>
    <Show when={props.type}>
      <div class="font-mono text-sm mb-1">
        <Type type={props.type!} />
      </div>
    </Show>
    <Show when={props.text?.trim()}>
      <Markdown.Inline source={props.text} />
    </Show>
  </>
)

/**
 * Single-glyph badge for a declaration kind. Use in dense lists (sidebar,
 * member cards, search palette) where a `K` / `ƒ` cue is enough.
 */
Type.KindBadge = (props: { kind: Kind | string; class?: string }) => (
  <span class={`font-mono text-xs text-mute text-center ${props.class ?? ''}`} title={labelOf(props.kind)}>
    {shortOf(props.kind)}
  </span>
)

/** Tracked uppercase label for a declaration kind (`MODULE`, `FUNCTION`, …). */
Type.KindLabel = (props: { kind: Kind | string; class?: string }) => (
  <span class={`text-xs uppercase tracking-wider text-mute ${props.class ?? ''}`}>{labelOf(props.kind)}</span>
)

/**
 * Declaration name rendered as a link to its own page when a routable id
 * resolves. Used in compact module-export lists where the signature is
 * read-only context and the name itself is the navigation target.
 */
Type.NameLink = (props: { id?: number; name: string; class?: string }) => {
  const slugs = useSlugFor()
  const slug = () => (props.id != null ? slugs.byId(props.id) : undefined)
  return (
    <Show when={slug()} fallback={<span class={props.class}>{props.name}</span>}>
      {(s) => (
        <A
          href={`/${s()}`}
          class={`${props.class ?? ''} hover:opacity-70 underline decoration-line decoration-dotted underline-offset-[3px]`}
        >
          {props.name}
        </A>
      )}
    </Show>
  )
}

const Punct = (p: { children: string }) => <span class="text-mute">{p.children}</span>
const Kw = (p: { children: string }) => <span class="text-accent">{p.children}</span>

const isOptional = (p: Types.Part<'parameter'>): boolean => p.optional || p.default != null

Type.SignatureLine = (props: {
  sig: Types.Part<'signature'>
  name?: string
  /** Owning declaration id — when set, the name renders as a link to its page. */
  id?: number
  kind?: 'function' | 'method' | 'constructor'
}) => (
  <div class="font-mono text-sm leading-relaxed py-2">
    <Show when={props.kind === 'constructor'}>
      <Kw>new </Kw>
    </Show>
    <Show when={props.name}>
      <Type.NameLink id={props.id} name={props.name!} class="font-semibold" />
    </Show>
    <Type.Generics generics={props.sig.generics} />
    <Punct>(</Punct>
    <For each={props.sig.params}>
      {(p, i) => (
        <>
          <Show when={i() > 0}>
            <Punct>{', '}</Punct>
          </Show>
          <Show when={p.rest}>
            <Punct>...</Punct>
          </Show>
          <span>{p.name}</span>
          <Show when={isOptional(p)}>
            <Punct>?</Punct>
          </Show>
          <Punct>: </Punct>
          <Type type={p.type} />
        </>
      )}
    </For>
    <Punct>)</Punct>
    <Punct>: </Punct>
    <Type type={props.sig.return} />
  </div>
)

/**
 * Type signature + its doc block. Parameter descriptions come from the
 * `@param` tags inside `sig.comment` and are rendered by `<Comment>` itself,
 * so there's no separate parameter table here.
 */
Type.Signature = (props: {
  sig: Types.Part<'signature'>
  name?: string
  id?: number
  kind?: 'function' | 'method' | 'constructor'
}) => {
  return (
    <div class="mb-8">
      <Type.SignatureLine sig={props.sig} name={props.name} id={props.id} kind={props.kind} />
      <Show when={props.sig.comment}>
        <div class="mt-2">
          <Comment comment={props.sig.comment} />
        </div>
      </Show>
    </div>
  )
}

Type.SignatureCompact = (props: {
  sig: Types.Part<'signature'>
  name?: string
  id?: number
  kind?: 'function' | 'method' | 'constructor'
}) => (
  <>
    <Type.SignatureLine sig={props.sig} name={props.name} id={props.id} kind={props.kind} />
    <Comment comment={props.sig.comment} />
  </>
)
