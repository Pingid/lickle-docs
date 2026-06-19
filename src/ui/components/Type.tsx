import { For, Show, createMemo, type Component } from 'solid-js'
import { A } from '../util/router.tsx'
import { Dynamic } from 'solid-js/web'

import { type Reflect } from '../context/index.tsx'

import { type Kind, labelOf, shortOf } from '../util/kind.ts'
import { commentSummaryText } from '../util/comment.ts'
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
  if (typeof t.value === 'bigint') return <span>{`${t.value}n`}</span>
  if (t.value === null) return <Syntax.Kw>null</Syntax.Kw>
  return <span>{String(t.value)}</span>
}

const Reference = (props: { type: Reflect.Type<'reference'> }) => {
  const t = props.type
  return (
    <>
      <Link.Type
        id={t.target.type === 'internal' ? t.target.id : undefined}
        name={t.name}
        external={t.target.type === 'external' ? t.target.external : undefined}
      />
      <TypeArgs args={t.args} />
    </>
  )
}

const Record = (props: { type: Reflect.Type<'record'> }) => {
  // A record of exactly one bare call signature renders as an arrow type.
  const onlySig = (): Reflect.Part<'signature'> | undefined => {
    const m = props.type.members
    const first = m.length === 1 ? m[0] : undefined
    return first?.kind === 'signature' && !first.construct ? first : undefined
  }
  const units = () => memberUnits(props.type.members)
  return (
    <Show when={!onlySig()} fallback={<SignatureExpr sig={onlySig()!} arrow />}>
      <Show when={units().length} fallback={<Syntax.Punct>{'{}'}</Syntax.Punct>}>
        <Syntax.Punct>{'{ '}</Syntax.Punct>
        <For each={units()}>
          {(u, i) => (
            <>
              <Show when={i() > 0}>
                <Syntax.Punct>{'; '}</Syntax.Punct>
              </Show>
              <MemberExpr unit={u} />
            </>
          )}
        </For>
        <Syntax.Punct>{' }'}</Syntax.Punct>
      </Show>
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
      <TypeP type={b.check} in="check" />
      <Syntax.Kw> extends </Syntax.Kw>
      <TypeP type={b.extends} in="check" />
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

const Union = (props: { type: Reflect.Type<'union'> }) => <Join sep=" | " items={props.type.types} in="union" />

const Intersection = (props: { type: Reflect.Type<'intersection'> }) => (
  <Join sep=" & " items={props.type.types} in="intersection" />
)

const Array = (props: { type: Reflect.Type<'array'> }) => (
  <>
    <TypeP type={props.type.elementType} in="postfix" />
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

/**
 * Single call signature renders as an arrow (`new (…) => R` for construct);
 * several render in object form — `{ (…): A; (…): B }` — so overloads stay visible.
 */
const FunctionType = (props: { type: Reflect.Type<'function-type'> }) => {
  const sigs = () => props.type.signatures
  return (
    <Show when={sigs().length} fallback={<Syntax.Kw>function</Syntax.Kw>}>
      <Show
        when={sigs().length === 1}
        fallback={
          <>
            <Syntax.Punct>{'{ '}</Syntax.Punct>
            <For each={sigs()}>
              {(sig, i) => (
                <>
                  <Show when={i() > 0}>
                    <Syntax.Punct>{'; '}</Syntax.Punct>
                  </Show>
                  <MemberExpr unit={{ member: sig }} />
                </>
              )}
            </For>
            <Syntax.Punct>{' }'}</Syntax.Punct>
          </>
        }
      >
        <Show when={sigs()[0]!.construct}>
          <Syntax.Kw>new </Syntax.Kw>
        </Show>
        <SignatureExpr sig={sigs()[0]!} arrow />
      </Show>
    </Show>
  )
}

const TypeOperator = (props: { type: Reflect.Type<'type-operator'> }) => (
  <>
    <Syntax.Kw>{props.type.operator}</Syntax.Kw>
    <span> </span>
    <TypeP type={props.type.target} in="operator" />
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
    <TypeP type={props.type.object} in="postfix" />
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

/**
 * Embedding contexts that bind tighter than some type expressions. The scanner
 * drops `ParenthesizedTypeNode`s, so renderers must reintroduce parens where
 * the surrounding syntax would otherwise change the meaning — `(A | B)[]`,
 * `A & (B | C)`, `(() => void) | null`.
 */
type ParenCtx = 'postfix' | 'operator' | 'union' | 'intersection' | 'check'

const PAREN_IN: Record<ParenCtx, Set<T['kind']>> = {
  /** Array `T[]` suffix, indexed-access object, optional tuple element `T?`. */
  postfix: new Set(['union', 'intersection', 'function-type', 'conditional', 'type-operator', 'infer', 'query']),
  /** `keyof` / `readonly` / `unique` operand. */
  operator: new Set(['union', 'intersection', 'function-type', 'conditional', 'infer']),
  union: new Set(['function-type', 'conditional', 'infer']),
  intersection: new Set(['union', 'function-type', 'conditional', 'infer']),
  /** Conditional `check extends extends` positions. */
  check: new Set(['function-type', 'conditional', 'infer']),
}

/** `Type`, parenthesized when the embedding context requires it. */
const TypeP = (props: { type: T | undefined; in: ParenCtx }) => {
  const need = () => !!props.type && PAREN_IN[props.in].has(props.type.kind)
  return (
    <>
      <Show when={need()}>
        <Syntax.Punct>(</Syntax.Punct>
      </Show>
      <Type type={props.type} />
      <Show when={need()}>
        <Syntax.Punct>)</Syntax.Punct>
      </Show>
    </>
  )
}

/**
 * Drop a trailing `undefined` from a union when a rendered `?` marker already
 * conveys it, the way declaration emit prints optionals. Inferred types carry
 * the checker's truth (`string | undefined`); `x?: string | undefined` is noise.
 */
const stripUndefined = (t: T): T => {
  if (t.kind !== 'union') return t
  const types = t.types.filter((x) => !(x.kind === 'intrinsic' && x.name === 'undefined'))
  if (types.length === t.types.length) return t
  return types.length === 1 ? types[0]! : { ...t, types }
}

/** @internal */
export const Join = (props: { sep: string; items: T[]; in?: ParenCtx }) => (
  <For each={props.items}>
    {(t, i) => (
      <>
        <Show when={i() > 0}>
          <Syntax.Punct>{props.sep}</Syntax.Punct>
        </Show>
        <Show when={props.in} fallback={<Type type={t} />}>
          <TypeP type={t} in={props.in!} />
        </Show>
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

/** A member paired with one of its signatures — methods expand to one unit per overload. */
type MemberUnit = { member: Reflect.Member; sig?: Reflect.Part<'signature'> }

/** Flatten members to units in source order, splitting methods across their overloads. */
const memberUnits = (members: Reflect.Member[]): MemberUnit[] =>
  members.flatMap((member): MemberUnit[] =>
    member.kind === 'method' ? member.signatures.map((sig) => ({ member, sig })) : [{ member }],
  )

/** One member inline: `name?: T`, `name(sig)`, `[k: K]: V`, `(sig)` or `new (sig)`. */
const MemberExpr = (props: { unit: MemberUnit }) => {
  const m = props.unit.member
  if (m.kind === 'property')
    return (
      <>
        <Syntax.Name>{m.name}</Syntax.Name>
        <Show when={m.optional}>
          <Syntax.Punct>?</Syntax.Punct>
        </Show>
        <Syntax.Punct>: </Syntax.Punct>
        <Type type={m.optional ? stripUndefined(m.type) : m.type} />
        <Show when={m.defaultValue}>
          <Syntax.Punct>{` = ${m.defaultValue}`}</Syntax.Punct>
        </Show>
      </>
    )
  if (m.kind === 'index-signature')
    return (
      <>
        <Syntax.Punct>[</Syntax.Punct>
        <Syntax.Name>{m.parameter.name}</Syntax.Name>
        <Syntax.Punct>: </Syntax.Punct>
        <Type type={m.parameter.type} />
        <Syntax.Punct>]: </Syntax.Punct>
        <Type type={m.type} />
      </>
    )
  if (m.kind === 'method')
    return (
      <>
        <Syntax.Name>{m.name}</Syntax.Name>
        <SignatureExpr sig={props.unit.sig!} />
      </>
    )
  return (
    <>
      <Show when={m.construct}>
        <Syntax.Kw>new </Syntax.Kw>
      </Show>
      <SignatureExpr sig={m} />
    </>
  )
}

/**
 * Block listing of class / interface / object-type members in source order:
 * each member on its own line with a muted one-line summary, mirroring the
 * module link list. Methods render one line per overload. Shared by the
 * declaration pages and record type alias.
 * @internal
 */
export const Members = (props: { members: Reflect.Member[] }) => (
  <Show when={props.members.length}>
    <ul class="mt-8 space-y-3">
      <For each={memberUnits(props.members)}>
        {(u) => {
          const summary = commentSummaryText(u.sig?.comment ?? u.member.comment)
          return (
            <li>
              <div class="font-mono text-sm leading-relaxed">
                <MemberExpr unit={u} />
              </div>
              <Show when={summary}>
                <p class="text-sm text-mute mt-0.5 line-clamp-2">{summary}</p>
              </Show>
            </li>
          )
        }}
      </For>
    </ul>
  </Show>
)

const TupleElement = (props: { el: Reflect.Part<'tuple-element'> }) => {
  const type = () => (props.el.optional ? stripUndefined(props.el.type) : props.el.type)
  return (
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
      <Show when={!props.el.name && props.el.optional} fallback={<Type type={type()} />}>
        <TypeP type={type()} in="postfix" />
      </Show>
      <Show when={!props.el.name && props.el.optional}>
        <Syntax.Punct>?</Syntax.Punct>
      </Show>
    </>
  )
}

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
          <Show when={isOptional(p)}>
            <Syntax.Punct>?</Syntax.Punct>
          </Show>
          <Syntax.Punct>: </Syntax.Punct>
          <Type type={isOptional(p) ? stripUndefined(p.type) : p.type} />
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
          <Type type={isOptional(p) ? stripUndefined(p.type) : p.type} />
        </>
      )}
    </For>
    <Syntax.Punct>)</Syntax.Punct>
    <Syntax.Punct>: </Syntax.Punct>
    <Type type={props.sig.return} />
  </div>
)
