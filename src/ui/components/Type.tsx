import { For, Show, createMemo, type Component } from 'solid-js'
import { A } from '../util/router.tsx'
import { Dynamic } from 'solid-js/web'

import { type Reflect } from '../context/index.tsx'

import { type Kind, labelOf, shortOf } from '../util/kind.ts'
import { useSlugFor } from '../hooks/index.ts'

import { staticComponent } from '../util/solid.tsx'
import { MarkdownInline } from './Markdown.tsx'
import { Comment } from './Comment/index.tsx'
import { Syntax } from './Syntax.tsx'
import { Link } from './Link.tsx'

type T = Reflect.Type

/**
 * Type signature + its doc block. Parameter descriptions come from the
 * `@param` tags inside `sig.comment` and are rendered by `<Comment>` itself,
 * so there's no separate parameter table here.
 * @group components
 */
export const TypeSignature = (props: {
  sig: Reflect.Part<'signature'>
  name?: string
  id?: number
  kind?: 'function' | 'method' | 'constructor'
}) => {
  return (
    <div class="mb-8">
      <SignatureLine sig={props.sig} name={props.name} id={props.id} kind={props.kind} />
      <Show when={props.sig.comment}>
        <div class="mt-2">
          <Comment comment={props.sig.comment} />
        </div>
      </Show>
    </div>
  )
}

/**
 * Render an arbitrary type. The body re-evaluates when `props.type` changes
 * so that navigating between pages with different type shapes swaps the
 * sub-renderer instead of freezing on the original branch (a classic Solid
 * pitfall where a top-level `switch` in a component runs only on mount).
 * @group components
 */
export const Type = (props: { type: T | undefined }) => {
  const renderer = createMemo(() => staticComponent(props.type ? (RENDERERS[props.type.kind] ?? Unknown) : () => null))
  return (
    <Show when={props.type && renderer()}>
      {(r) => <Dynamic component={r() as Component<{ type: T }>} type={props.type!} />}
    </Show>
  )
}

// --- Variant renderers (one per `Types.Type['kind']`, ordered to match RENDERERS) ---

const Intrinsic = (props: { type: Reflect.Type<'intrinsic'> }) => <Syntax.Kw>{props.type.name}</Syntax.Kw>

const Literal = (props: { type: Reflect.Type<'literal'> }) => {
  const t = props.type
  if (typeof t.value === 'string') return <span class="text-fg">"{t.value}"</span>
  if (t.value === null) return <Syntax.Kw>null</Syntax.Kw>
  return <span>{String(t.value)}</span>
}

const Reference = (props: { type: Reflect.Type<'reference'> }) => {
  const t = props.type
  return (
    <>
      <Link.Type
        id={t.type === 'internal' ? t.targetId : undefined}
        name={t.name}
        external={t.type === 'external' ? t.external : undefined}
      />
      <TypeArgs args={t.args} />
    </>
  )
}

const Record = (props: { type: Reflect.Type<'record'> }) => {
  const decl = props.type
  const onlySignatures =
    decl.callSignatures?.length === 1 &&
    !decl.properties.length &&
    !decl.methods?.length &&
    !decl.indexSignature &&
    !decl.constructSignatures?.length
  if (onlySignatures) return <SignatureExpr sig={decl.callSignatures![0]!} arrow />

  // Every member kind, flattened to renderers so a single `<For>` lays them
  // out with consistent `; ` separators.
  const members = (): (() => any)[] => [
    ...decl.properties.map((p) => () => <RecordProperty prop={p} />),
    ...(decl.methods ?? []).flatMap((m) => m.signatures.map((sig) => () => <RecordMethod name={m.name} sig={sig} />)),
    ...(decl.indexSignature ? [() => <RecordIndex sig={decl.indexSignature!} />] : []),
    ...(decl.callSignatures ?? []).map((sig) => () => <SignatureExpr sig={sig} />),
    ...(decl.constructSignatures ?? []).map((sig) => () => (
      <>
        <Syntax.Kw>new </Syntax.Kw>
        <SignatureExpr sig={sig} />
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
 * @group components
 */
const Conditional = (props: { type: Reflect.Type<'conditional'> }) => {
  const chain = createMemo(() => {
    const branches: Reflect.Type<'conditional'>[] = []
    let cur: Reflect.Type | undefined = props.type
    while (cur?.kind === 'conditional') {
      branches.push(cur)
      cur = cur.false
    }
    return { branches, tail: cur }
  })
  const head = (b: Reflect.Type<'conditional'>) => (
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

const Union = (props: { type: Reflect.Type<'union'> }) => <Join sep=" | " items={props.type.types} />

const Intersection = (props: { type: Reflect.Type<'intersection'> }) => <Join sep=" & " items={props.type.types} />

const Array = (props: { type: Reflect.Type<'array'> }) => (
  <>
    <Type type={props.type.elementType} />
    <Syntax.Punct>[]</Syntax.Punct>
  </>
)

const Tuple = (props: { type: Reflect.Type<'tuple'> }) => (
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

const FunctionType = (props: { type: Reflect.Type<'function-type'> }) => (
  <Show when={props.type.signatures[0]} fallback={<Syntax.Kw>function</Syntax.Kw>}>
    {(sig) => <SignatureExpr sig={sig()} arrow />}
  </Show>
)

const TypeOperator = (props: { type: Reflect.Type<'type-operator'> }) => (
  <>
    <Syntax.Kw>{props.type.operator}</Syntax.Kw>
    <span> </span>
    <Type type={props.type.target} />
  </>
)

const Infer = (props: { type: Reflect.Type<'infer'> }) => (
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

const IndexedAccess = (props: { type: Reflect.Type<'indexed-access'> }) => (
  <>
    <Type type={props.type.object} />
    <Syntax.Punct>[</Syntax.Punct>
    <Type type={props.type.index} />
    <Syntax.Punct>]</Syntax.Punct>
  </>
)

const Mapped = (props: { type: Reflect.Type<'mapped'> }) => {
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

const Query = (props: { type: Reflect.Type<'query'> }) => (
  <>
    <Syntax.Kw>typeof </Syntax.Kw>
    <Syntax.Name>{props.type.name}</Syntax.Name>
    <TypeArgs args={props.type.args} />
  </>
)

const TemplateLiteral = (props: { type: Reflect.Type<'template-literal'> }) => (
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

const Predicate = (props: { type: Reflect.Type<'predicate'> }) => (
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

const ImportType = (props: { type: Reflect.Type<'import-type'> }) => {
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
      <TypeArgs args={t.args} />
    </>
  )
}

/** Catch-all: the parser's `unknown` kind, plus any runtime kind without a renderer. */
const Unknown = (props: { type: Reflect.Type }) => (
  <Syntax.Name>{(props.type as { text?: string; kind: string }).text ?? props.type.kind}</Syntax.Name>
)

const RENDERERS: { [K in Reflect.Type['kind']]: Component<{ type: Reflect.Type<K> }> } = {
  intrinsic: Intrinsic,
  literal: Literal,
  reference: Reference,
  record: Record,
  conditional: Conditional,
  union: Union,
  intersection: Intersection,
  array: Array,
  tuple: Tuple,
  'function-type': FunctionType,
  'type-operator': TypeOperator,
  infer: Infer,
  'indexed-access': IndexedAccess,
  mapped: Mapped,
  query: Query,
  'template-literal': TemplateLiteral,
  predicate: Predicate,
  'import-type': ImportType,
  unknown: Unknown,
}

// --- Shared building blocks used by the variant renderers ---

/** @internal */
export const Join = (props: { sep: string; items: T[] }) => (
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

const TypeArgs = (props: { args?: T[] }) => (
  <Show when={props.args?.length}>
    <Syntax.Punct>{'<'}</Syntax.Punct>
    <Join sep=", " items={props.args!} />
    <Syntax.Punct>{'>'}</Syntax.Punct>
  </Show>
)

const RecordProperty = (props: { prop: Reflect.Part<'property'> }) => (
  <>
    <Syntax.Name>{props.prop.name}</Syntax.Name>
    <Show when={props.prop.optional}>
      <Syntax.Punct>?</Syntax.Punct>
    </Show>
    <Syntax.Punct>: </Syntax.Punct>
    <Type type={props.prop.type} />
  </>
)

const RecordMethod = (props: { name: string; sig: Reflect.Part<'signature'> }) => (
  <>
    <Syntax.Name>{props.name}</Syntax.Name>
    <SignatureExpr sig={props.sig} />
  </>
)

const RecordIndex = (props: { sig: Reflect.Part<'index-signature'> }) => (
  <>
    <Syntax.Punct>[</Syntax.Punct>
    <Syntax.Name>{props.sig.parameter.name}</Syntax.Name>
    <Syntax.Punct>: </Syntax.Punct>
    <Type type={props.sig.parameter.type} />
    <Syntax.Punct>]: </Syntax.Punct>
    <Type type={props.sig.type} />
  </>
)

const TupleElement = (props: { el: Reflect.Part<'tuple-element'> }) => (
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

/** @internal */
export const SignatureExpr = (props: { sig: Reflect.Part<'signature'>; arrow?: boolean }) => (
  <>
    <Generics generics={props.sig.generics} />
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

/**
 * Type parameter list — `<T extends C = D>`.
 * @internal
 */
export const Generics = (props: { generics?: Reflect.Part<'generic'>[] }) => (
  <Show when={props.generics?.length}>
    <Syntax.Punct>{'<'}</Syntax.Punct>
    <For each={props.generics!}>
      {(tp, i) => (
        <>
          <Show when={i() > 0}>
            <Syntax.Punct>{', '}</Syntax.Punct>
          </Show>
          <Syntax.TypeArg>{tp.name}</Syntax.TypeArg>
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

/** @internal */
export const TypeBlock = (props: { type: T | undefined }) => (
  <code class="font-mono text-[0.85em] leading-relaxed">
    <Type type={props.type} />
  </code>
)

/** @internal */
export const TypeBox = (props: { type: T | undefined; class?: string }) => (
  <div class={`codeblock ${props.class ?? ''}`}>
    <Type type={props.type} />
  </div>
)

/** @internal */
export const Inline = (props: { type?: Reflect.Type; text: string }) => (
  <>
    <Show when={props.type}>
      <div class="font-mono text-sm mb-1">
        <Type type={props.type!} />
      </div>
    </Show>
    <Show when={props.text?.trim()}>
      <MarkdownInline source={props.text} />
    </Show>
  </>
)

/**
 * Single-glyph badge for a declaration kind. Use in dense lists (sidebar,
 * member cards, search palette) where a `K` / `ƒ` cue is enough.
 * @internal
 */
export const KindBadge = (props: { kind: Kind | string; class?: string }) => (
  <span class={`font-mono text-xs text-mute text-center ${props.class ?? ''}`} title={labelOf(props.kind)}>
    {shortOf(props.kind)}
  </span>
)

/**
 * Tracked uppercase label for a declaration kind (`MODULE`, `FUNCTION`, …).
 * @internal
 */
export const KindLabel = (props: { kind: Kind | string; class?: string }) => (
  <span class={`text-xs uppercase tracking-wider text-mute ${props.class ?? ''}`}>{labelOf(props.kind)}</span>
)

/**
 * Declaration name rendered as a link to its own page when a routable id
 * resolves. Used in compact module-export lists where the signature is
 * read-only context and the name itself is the navigation target.
 */
const NameLink = (props: { id?: number; name: string; class?: string }) => {
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

const isOptional = (p: Reflect.Part<'parameter'>): boolean => p.optional || p.default != null

/** @internal */
export const SignatureLine = (props: {
  sig: Reflect.Part<'signature'>
  name?: string
  /** Owning declaration id — when set, the name renders as a link to its page. */
  id?: number
  kind?: 'function' | 'method' | 'constructor'
}) => (
  <div class="font-mono text-sm leading-relaxed py-2">
    <Show when={props.kind === 'constructor'}>
      <Syntax.Kw>new </Syntax.Kw>
    </Show>
    <Show when={props.name}>
      <NameLink id={props.id} name={props.name!} class="font-semibold" />
    </Show>
    <Generics generics={props.sig.generics} />
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
          <span>{p.name}</span>
          <Show when={isOptional(p)}>
            <Syntax.Punct>?</Syntax.Punct>
          </Show>
          <Syntax.Punct>: </Syntax.Punct>
          <Type type={p.type} />
        </>
      )}
    </For>
    <Syntax.Punct>)</Syntax.Punct>
    <Syntax.Punct>: </Syntax.Punct>
    <Type type={props.sig.return} />
  </div>
)
