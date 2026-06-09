import { groupItems } from '../../core/client/index.ts'
import type { Types } from '../context/index.tsx'
import { withBaseUrl } from './base.ts'
import { labelOf } from './kind.ts'

/** Resolve a `{@link Name}` reference to its slug, for inline comment links. */
export type SlugOf = (name: string) => string | undefined

export interface MarkdownOptions {
  /** Inline every module/namespace member's full documentation, recursively. */
  inlineMembers?: boolean
}

type Ctx = { project: Types.Project; slugOf: SlugOf; inline: boolean; seen: Set<number> }

/**
 * Serialize a route's main content to markdown: the title, declaration body
 * (signatures, type, JSDoc) and member listings. "Referenced In" backlinks are
 * intentionally dropped. Mirrors the JSX renderers in `components/` as strings.
 *
 * With `inlineMembers`, module/namespace exports are expanded in place (their
 * full docs, recursively) instead of listed as links.
 */
export const routeToMarkdown = (
  route: Types.Route,
  project: Types.Project,
  slugOf: SlugOf,
  opts: MarkdownOptions = {},
): string => renderRoute(route, { project, slugOf, inline: !!opts.inlineMembers, seen: new Set() }, 1)

const renderRoute = (route: Types.Route, ctx: Ctx, depth: number): string => {
  if (route.kind === 'page') return route.body.join('\n\n').trimEnd() + '\n'
  return statementMd(route, ctx, depth)
}

const statementMd = (route: Types.DocRoute, ctx: Ctx, depth: number): string => {
  const decl = ctx.project.byId(route.decl)
  const h = '#'.repeat(Math.min(depth, 6))
  if (!decl) return `${h} ${route.title}\n`
  if (ctx.inline && ctx.seen.has(decl.id)) return ''
  ctx.seen.add(decl.id)
  let out = `${h} ${route.title}\n\n*${labelOf(decl.kind)}*\n\n`
  const src = decl.sources?.[0]
  if (src) out += `\`${src.file}:${src.line}\`\n\n`
  out += declarationToMarkdown(decl, ctx.slugOf)
  out += childrenMd(route, ctx, depth)
  return out.trimEnd() + '\n'
}

/**
 * Module/namespace exports from the route's `links`. Listed as links by
 * default, or — when `ctx.inline` — expanded in place with each member's full
 * documentation.
 */
const childrenMd = (route: Types.DocRoute, ctx: Ctx, depth: number): string => {
  if (!route.links.length) return ''
  let out = ''
  for (const g of groupItems(route.links, (l) => l.group)) {
    if (ctx.inline) {
      for (const item of g.items) {
        const child = ctx.project.routes.get({ id: item.target })
        if (child?.kind !== 'doc') continue
        const md = renderRoute(child, ctx, depth + 1)
        if (md.trim()) out += `\n${md}`
      }
    } else {
      out += `\n${'#'.repeat(Math.min(depth + 1, 6))} ${g.group || 'Members'}\n\n`
      for (const item of g.items) {
        const child = ctx.project.routes.get({ id: item.target })
        const d = child?.kind === 'doc' ? ctx.project.byId(child.decl) : undefined
        out += `- \`${child?.title ?? item.alias}\`${inlineComment(d?.comment, ctx.slugOf)}\n`
      }
    }
  }
  return out
}

// ============================================================================
// DECLARATIONS
// ============================================================================

export const declarationToMarkdown = (decl: Types.Declaration, slugOf: SlugOf): string => {
  const fn = DECL[decl.kind] as ((d: Types.Declaration, s: SlugOf) => string) | undefined
  return fn ? fn(decl, slugOf) : commentBlock((decl as { comment?: Types.Comment }).comment, slugOf)
}

const DECL: { [K in Types.Declaration['kind']]?: (d: Types.Declaration<K>, slugOf: SlugOf) => string } = {
  function: (d, s) => signature(d.signatures.map((sig) => sigLine(sig, d.name)).join('\n'), d.comment, s),
  variable: (d, s) =>
    signature(`const ${d.name}: ${typeStr(d.type)}${d.defaultValue ? ` = ${d.defaultValue}` : ''}`, d.comment, s),
  'type-alias': (d, s) => signature(`type ${d.name}${generics(d.generics)} = ${typeStr(d.type)}`, d.comment, s),
  class: (d, s) =>
    heritage('extends', d.extends) + heritage('implements', d.implements) + commentBlock(d.comment, s) + members(d, s),
  interface: (d, s) => heritage('extends', d.extends) + commentBlock(d.comment, s) + members(d, s),
  enum: (d, s) =>
    commentBlock(d.comment, s) +
    subsection(
      'Members',
      d.members.map((m) => `- \`${m.name}${enumValue(m)}\`${inlineComment(m.comment, s)}\n`).join(''),
    ),
  module: (d, s) => commentBlock(d.comment, s),
  namespace: (d, s) => commentBlock(d.comment, s),
}

const enumValue = (m: Types.Part<'enum-member'>): string =>
  m.value === undefined ? '' : ` = ${typeof m.value === 'string' ? `"${m.value}"` : m.value}`

const heritage = (label: string, types?: Types.Type[]): string =>
  types?.length ? `*${label}* ${types.map(typeStr).join(', ')}\n\n` : ''

/** Shared class/interface member sections, each a `###` subsection of `- ` rows. */
const members = (
  m: {
    constructors?: Types.Part<'signature'>[]
    properties?: Types.Part<'property'>[]
    methods?: Types.Part<'method'>[]
    callSignatures?: Types.Part<'signature'>[]
    constructSignatures?: Types.Part<'signature'>[]
    indexSignature?: Types.Part<'index-signature'>
  },
  s: SlugOf,
): string => {
  let out = ''
  if (m.constructors?.length)
    out += subsection('Constructors', m.constructors.map((sig) => sigItem(sig, s, 'constructor')).join(''))
  if (m.properties?.length || m.indexSignature) {
    const props = (m.properties ?? []).map((p) => propItem(p, s)).join('')
    const idx = m.indexSignature ? `- \`${indexSig(m.indexSignature)}\`\n` : ''
    out += subsection('Properties', props + idx)
  }
  if (m.methods?.length)
    out += subsection(
      'Methods',
      m.methods.flatMap((mm) => mm.signatures.map((sig) => sigItem(sig, s, undefined, mm.name))).join(''),
    )
  if (m.callSignatures?.length)
    out += subsection('Call Signatures', m.callSignatures.map((sig) => sigItem(sig, s)).join(''))
  if (m.constructSignatures?.length)
    out += subsection(
      'Construct Signatures',
      m.constructSignatures.map((sig) => sigItem(sig, s, 'constructor')).join(''),
    )
  return out
}

const propItem = (p: Types.Part<'property'>, s: SlugOf): string =>
  `- \`${p.name}${p.optional ? '?' : ''}: ${typeStr(p.type)}${p.defaultValue ? ` = ${p.defaultValue}` : ''}\`${inlineComment(p.comment, s)}\n`

const sigItem = (sig: Types.Part<'signature'>, s: SlugOf, kind?: 'constructor', name?: string): string =>
  `- \`${sigLine(sig, name, kind)}\`${inlineComment(sig.comment, s)}\n`

const indexSig = (sig: Types.Part<'index-signature'>): string =>
  `[${sig.parameter.name}: ${typeStr(sig.parameter.type)}]: ${typeStr(sig.type)}`

// ============================================================================
// COMMENTS
// ============================================================================

/**
 * Markdown for a comment's summary (the prose before block tags). `{@link}`
 * references resolve to markdown links via {@link SlugOf}. Block tags are not
 * included — see {@link commentBlock} for the full rendering.
 */
export const commentToMarkdown = (comment: Types.Comment, slugOf: SlugOf): string => {
  let out = ''
  for (const p of comment.parts) {
    if (p.kind === 'text') {
      out += p.text
      continue
    }
    const label = p.text ?? p.target
    const slug = slugOf(p.target)
    const display = p.style === 'code' ? `\`${label}\`` : label
    out += slug ? `[${display}](${withBaseUrl(slug)})` : display
  }
  return out
}

/** Full comment: summary prose followed by its block tags. */
const commentBlock = (comment: Types.Comment | undefined, slugOf: SlugOf): string => {
  if (!comment) return ''
  let out = commentToMarkdown(comment, slugOf).trim()
  if (out) out += '\n'
  let inNamed: '@param' | '@property' | null = null
  for (const t of comment.tags ?? []) {
    const named = t.tag === '@param' || t.tag === '@property' ? t.tag : null
    if (named && named !== inNamed) out += `\n**${named === '@param' ? 'Parameters' : 'Properties'}**\n\n`
    inNamed = named
    out += tagMd(t, slugOf)
  }
  return out ? out + '\n' : ''
}

const tagMd = (t: Types.CommentTag, slugOf: SlugOf): string => {
  switch (t.kind) {
    case '@param':
    case '@property':
      return `- \`${t.name}${t.optional ? '?' : ''}\`${t.type ? `: \`${typeStr(t.type)}\`` : ''}${desc(t.text)}\n`
    case '@returns':
      return `\n**Returns**${t.type ? ` \`${typeStr(t.type)}\`` : ''}${desc(t.text)}\n`
    case '@throws':
      return `\n**Throws**${t.type ? ` \`${typeStr(t.type)}\`` : ''}${desc(t.text)}\n`
    case '@example': {
      // Defensive: if `code` still carries a fence, unwrap it so we never nest.
      const block = firstCodeBlock(t.code)
      return `\n**Example**${t.caption ? ` ${t.caption}` : ''}\n\n${fence(block.code, t.lang || block.lang || 'ts')}`
    }
    case '@see':
      return `\n**See**${t.text ? ` ${commentText(t.text, t.target, slugOf)}` : ''}\n`
    default: {
      const label = t.tag.replace(/^@/, '')
      const caption = (t as { caption?: string }).caption
      const body = (t as { text?: string }).text?.trim()
      const head = `\n**${label}**${caption ? ` ${caption}` : ''}`
      return body ? `${head}\n\n${body}\n` : `${head}\n`
    }
  }
}

const commentText = (text: string, target: string | undefined, slugOf: SlugOf): string => {
  const slug = target ? slugOf(target) : undefined
  return slug ? `[${text || target}](${withBaseUrl(slug)})` : text
}

/** First line of a comment summary, for inline ` — desc` suffixes in lists. */
const inlineComment = (comment: Types.Comment | undefined, slugOf: SlugOf): string => {
  const s = comment ? commentToMarkdown(comment, slugOf).split('\n')[0]?.trim() : ''
  return s ? ` — ${s}` : ''
}

const desc = (text?: string): string => {
  const t = (text ?? '').replace(/^\s*-\s*/, '').trim()
  return t ? ` — ${t}` : ''
}

// ============================================================================
// TYPES
// ============================================================================

type T = Types.Type

/** Render an arbitrary type to a TypeScript-like string. Mirrors `Type.tsx`. */
export const typeStr = (type: T | undefined): string => {
  if (!type) return ''
  const fn = TYPE[type.kind] as ((t: T) => string) | undefined
  return fn ? fn(type) : ((type as { text?: string }).text ?? type.kind)
}

const TYPE: { [K in T['kind']]?: (t: Types.Type<K>) => string } = {
  intrinsic: (t) => t.name,
  literal: (t) => (typeof t.value === 'string' ? `"${t.value}"` : String(t.value)),
  reference: (t) => `${t.name}${typeArgs(t.args)}`,
  union: (t) => t.types.map(typeStr).join(' | '),
  intersection: (t) => t.types.map(typeStr).join(' & '),
  array: (t) => `${typeStr(t.elementType)}[]`,
  tuple: (t) => `[${t.elements.map(tupleEl).join(', ')}]`,
  'function-type': (t) => (t.signatures[0] ? sigExpr(t.signatures[0], true) : 'function'),
  'type-operator': (t) => `${t.operator} ${typeStr(t.target)}`,
  record: (t) => recordStr(t),
  conditional: (t) => `${typeStr(t.check)} extends ${typeStr(t.extends)} ? ${typeStr(t.true)} : ${typeStr(t.false)}`,
  infer: (t) => `infer ${t.name}${t.constraint ? ` extends ${typeStr(t.constraint)}` : ''}`,
  'indexed-access': (t) => `${typeStr(t.object)}[${typeStr(t.index)}]`,
  mapped: (t) => mappedStr(t),
  query: (t) => `typeof ${t.name}${typeArgs(t.args)}`,
  'template-literal': (t) => `\`${t.head}${t.spans.map((sp) => `\${${typeStr(sp.type)}}${sp.literal}`).join('')}\``,
  predicate: (t) => `${t.asserts ? 'asserts ' : ''}${t.parameter}${t.type ? ` is ${typeStr(t.type)}` : ''}`,
  'import-type': (t) =>
    `${t.isTypeOf ? 'typeof ' : ''}import("${t.argument}")${t.qualifier ? `.${t.qualifier}` : ''}${typeArgs(t.args)}`,
}

const recordStr = (t: Types.Type<'record'>): string => {
  const onlySig =
    t.callSignatures?.length === 1 &&
    !t.properties.length &&
    !t.methods?.length &&
    !t.indexSignature &&
    !t.constructSignatures?.length
  if (onlySig) return sigExpr(t.callSignatures![0]!, true)
  const items = [
    ...t.properties.map((p) => `${p.name}${p.optional ? '?' : ''}: ${typeStr(p.type)}`),
    ...(t.methods ?? []).flatMap((m) => m.signatures.map((sig) => `${m.name}${sigExpr(sig)}`)),
    ...(t.indexSignature ? [indexSig(t.indexSignature)] : []),
    ...(t.callSignatures ?? []).map((sig) => sigExpr(sig)),
    ...(t.constructSignatures ?? []).map((sig) => `new ${sigExpr(sig)}`),
  ]
  return items.length ? `{ ${items.join('; ')} }` : '{}'
}

const mappedStr = (t: Types.Type<'mapped'>): string => {
  const tp = t.typeParameter
  return `{ ${t.readonly ? 'readonly ' : ''}[${tp.name}${tp.constraint ? ` in ${typeStr(tp.constraint)}` : ''}${t.nameType ? ` as ${typeStr(t.nameType)}` : ''}]${t.optional ? '?' : ''}: ${typeStr(t.type)} }`
}

const tupleEl = (el: Types.Part<'tuple-element'>): string =>
  `${el.rest ? '...' : ''}${el.name ? `${el.name}${el.optional ? '?' : ''}: ` : ''}${typeStr(el.type)}${!el.name && el.optional ? '?' : ''}`

const typeArgs = (args?: T[]): string => (args?.length ? `<${args.map(typeStr).join(', ')}>` : '')

const generics = (gs?: Types.Part<'generic'>[]): string =>
  gs?.length
    ? `<${gs
        .map(
          (g) =>
            `${g.name}${g.constraint ? ` extends ${typeStr(g.constraint)}` : ''}${g.default ? ` = ${typeStr(g.default)}` : ''}`,
        )
        .join(', ')}>`
    : ''

const params = (ps: Types.Part<'parameter'>[]): string =>
  ps
    .map((p) => `${p.rest ? '...' : ''}${p.name}${p.optional || p.default != null ? '?' : ''}: ${typeStr(p.type)}`)
    .join(', ')

/** Anonymous signature, `<T>(a: A) => R` or `<T>(a: A): R`. */
const sigExpr = (sig: Types.Part<'signature'>, arrow = false): string =>
  `${generics(sig.generics)}(${params(sig.params)})${arrow ? ' => ' : ': '}${typeStr(sig.return)}`

/** Named signature line, `new? name<T>(a: A): R`. */
const sigLine = (sig: Types.Part<'signature'>, name?: string, kind?: 'constructor'): string =>
  `${kind === 'constructor' ? 'new ' : ''}${name ?? ''}${generics(sig.generics)}(${params(sig.params)}): ${typeStr(sig.return)}`

// ============================================================================
// HELPERS
// ============================================================================

/** Fenced code block. Empty code yields nothing (no stray empty fences). */
const fence = (code: string, lang = 'ts'): string => (code.trim() ? `\`\`\`${lang}\n${code}\n\`\`\`\n` : '')

/** A signature fence followed by its comment, with a blank line between them. */
const signature = (code: string, comment: Types.Comment | undefined, s: SlugOf): string => {
  const c = commentBlock(comment, s).replace(/^\n+/, '')
  return fence(code) + (c ? `\n${c}` : '')
}

const subsection = (title: string, body: string): string => (body.trim() ? `\n### ${title}\n\n${body}` : '')

const CODE_BLOCK_RE = /```([^\n]*)\n([\s\S]*?)```/g
const extractCodeBlocks = (input: string): { lang: string; code: string }[] => [
  ...(input?.matchAll(CODE_BLOCK_RE)?.map((m) => ({ lang: m[1]!, code: m[2]! })) ?? []),
]

const firstCodeBlock = (input: string): { lang: string; code: string } =>
  extractCodeBlocks(input)?.[0] ?? { lang: '', code: input }
