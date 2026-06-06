import type { ScanState as State } from '../state.ts'
import ts from 'typescript'

import type * as T from '../types.ts'

import { scan } from './index.ts'

/** JSDoc attached to a declaration. Bails on `@module` blocks (those belong to the module). */
export const commentForNode = (s: State, node: ts.Node): T.Comment | undefined => {
  const parts: T.CommentPart[] = []
  const tags: T.CommentTag[] = []
  let seen = false
  for (const doc of ts.getJSDocCommentsAndTags(node)) {
    if (!ts.isJSDoc(doc)) continue
    seen = true
    if (collectDoc(s, doc, parts, tags)) return undefined // `@module` belongs to the module
  }
  return finish(parts, tags, seen)
}

/**
 * The module banner: leading comments on the first statement. A range counts as
 * the banner when it is followed by another comment or carries `@module`.
 */
export const commentForModule = (s: State, sf: ts.SourceFile): T.Comment | undefined => {
  const first = sf.statements[0]
  if (!first) return undefined
  const text = sf.getFullText()
  const ranges = ts.getLeadingCommentRanges(text, first.pos)
  if (!ranges?.length) return undefined

  const parts: T.CommentPart[] = []
  const tags: T.CommentTag[] = []
  let seen = false
  ranges.forEach((range, i) => {
    const raw = text.slice(range.pos, range.end)
    if (i < ranges.length - 1 || raw.includes('@module')) {
      const doc = reparseJsDoc(raw)
      if (doc) {
        seen = true
        collectDoc(s, doc, parts, tags)
      }
    }
  })
  return finish(parts, tags, seen)
}

/** Walk a JSDoc block into `parts`/`tags`. Returns true if a `@module` tag was seen. */
const collectDoc = (s: State, doc: ts.JSDoc, parts: T.CommentPart[], tags: T.CommentTag[]): boolean => {
  appendCommentBody(doc.comment, parts)
  let hasModule = false
  for (const t of doc.tags ?? []) {
    const tag = buildTag(s, t)
    if (tag.tag === '@module') hasModule = true
    tags.push(tag)
  }
  return hasModule
}

const finish = (parts: T.CommentPart[], tags: T.CommentTag[], seen: boolean): T.Comment | undefined =>
  seen ? { parts, ...(tags.length ? { tags } : {}) } : undefined

/** Reparse a raw comment string into a JSDoc node via a throwaway source file. */
const reparseJsDoc = (raw: string): ts.JSDoc | undefined => {
  // Append `;` so the parser has a statement to attach the JSDoc to.
  const dummy = ts.createSourceFile('dummy.ts', `${raw}\n;`, ts.ScriptTarget.Latest, true)
  const stmt = dummy.statements[0]
  if (!stmt) return undefined
  return ts.getJSDocCommentsAndTags(stmt).find(ts.isJSDoc) as ts.JSDoc | undefined
}

/** Flatten a JSDoc comment into `parts`. */
const appendCommentBody = (
  comment: string | ts.NodeArray<ts.JSDocComment> | undefined,
  parts: T.CommentPart[],
): void => {
  if (!comment) return
  if (typeof comment === 'string') {
    const trimmed = comment.trim()
    if (trimmed) parts.push({ kind: 'text', text: trimmed })
    return
  }
  for (const c of comment) {
    if (c.kind === ts.SyntaxKind.JSDocText) {
      parts.push({ kind: 'text', text: c.text })
      continue
    }
    const target = c.name?.getText() ?? ''
    const linkText = c.text || undefined
    const style = ts.isJSDocLinkCode(c) ? ('code' as const) : ts.isJSDocLinkPlain(c) ? ('plain' as const) : undefined
    parts.push({ kind: 'link', target, ...(linkText ? { text: linkText } : {}), ...(style ? { style } : {}) })
  }
}

const buildTag = (s: State, tag: ts.JSDocTag): T.CommentTag => {
  const text = ts.getTextOfJSDocComment(tag.comment)?.trim() ?? ''
  const exprType = (te?: ts.JSDocTypeExpression) => (te ? scan.Type(s, te.type) : undefined)
  if (ts.isJSDocPropertyTag(tag)) {
    return {
      kind: '@property',
      tag: '@property',
      name: tag.name.getText(),
      type: exprType(tag.typeExpression),
      text,
    }
  }
  if (ts.isJSDocParameterTag(tag)) {
    return {
      kind: '@param',
      tag: '@param',
      name: tag.name.getText(),
      type: exprType(tag.typeExpression),
      ...(tag.isBracketed ? { optional: true } : {}),
      text,
    }
  }
  if (ts.isJSDocReturnTag(tag)) {
    const type = exprType(tag.typeExpression)
    return { kind: '@returns', tag: '@returns', ...(type ? { type } : {}), text }
  }
  if (ts.isJSDocThrowsTag(tag)) {
    const type = exprType(tag.typeExpression)
    return { kind: '@throws', tag: '@throws', ...(type ? { type } : {}), text }
  }
  if (ts.isJSDocTypeTag(tag)) return { kind: '@type', tag: '@type', type: exprType(tag.typeExpression)!, text }
  if (ts.isJSDocSatisfiesTag(tag))
    return { kind: '@satisfies', tag: '@satisfies', type: exprType(tag.typeExpression)!, text }
  if (ts.isJSDocTemplateTag(tag)) {
    return {
      kind: '@template',
      tag: '@template',
      generics: tag.typeParameters.map((tp) => scan.TypeParam(s, tp)),
      text,
    }
  }
  if (ts.isJSDocSeeTag(tag)) {
    return { kind: '@see', tag: '@see', ...(tag.name ? { target: tag.name.name.getText() } : {}), text }
  }
  if (ts.isJSDocAugmentsTag(tag)) return { kind: '@augments', tag: '@augments', class: scan.Type(s, tag.class), text }
  if (ts.isJSDocImplementsTag(tag))
    return { kind: '@implements', tag: '@implements', class: scan.Type(s, tag.class), text }
  const name = '@' + tag.tagName.text
  // `@example` carries semantic indentation; re-extract from source so the
  // leader-strip never eats author tabs (see `rawTagBody`).
  if (name === '@example') return parseExample(rawTagBody(tag))
  return { kind: '*', tag: name, text }
}

/**
 * Reconstruct the body of a JSDoc tag from source, stripping the per-line
 * `*` leader and at most one *space* of separator. Unlike
 * `ts.getTextOfJSDocComment` — which strips `[ \t]?` and so eats a single
 * tab of user indentation — this preserves tabs intact.
 */
const rawTagBody = (tag: ts.JSDocTag): string => {
  const src = tag.getSourceFile().text
  // Body starts immediately after the tag name (`@example`), runs to tag end.
  const raw = src.slice(tag.tagName.end, tag.end)
  return raw
    .split('\n')
    .map((line, i) => (i === 0 ? line : line.replace(/^[ \t]*\*( ?)/, '')))
    .join('\n')
    .trim()
}

/**
 * Pull an optional caption out of an `@example` body. Two forms are recognised:
 *   1. Legacy JSDoc: `<caption>…</caption>` prefix.
 *   2. TypeDoc-style: any text on the line(s) before the first fenced code
 *      block becomes the caption; the fence and its body become the code.
 * When neither pattern matches, the entire body is treated as `code`.
 */
const parseExample = (raw: string): T.CommentTagMap['@example'] => {
  const html = raw.match(/^<caption>([\s\S]*?)<\/caption>\s*([\s\S]*)$/)
  if (html) return { kind: '@example', tag: '@example', caption: html[1]!.trim(), code: html[2]!.trim() }
  const fence = raw.search(/^```/m)
  if (fence > 0) {
    const caption = raw.slice(0, fence).trim()
    if (caption) return { kind: '@example', tag: '@example', caption, code: raw.slice(fence).trim() }
  }
  return { kind: '@example', tag: '@example', code: raw.trim() }
}
