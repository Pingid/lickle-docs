import { makeScanState, type ScanOptions, type ScanState as State } from './state.ts'
import ts from 'typescript'

import type * as T from '../types.ts'

export const scan = (rootFiles: string[], options: ScanOptions) => {
  const program = ts.createProgram(rootFiles, options.compilerOptions)
  const checker = program.getTypeChecker()
  const s = makeScanState(checker, options)

  const files = new Array<ts.SourceFile>()
  for (const file of rootFiles) {
    const sf = program.getSourceFile(file)
    if (!sf) continue
    files.push(sf)
  }

  while (files.length) {
    const sf = files.shift()!
    scan.SourceFile(s, sf, files)
  }

  return s
}

scan.SourceFile = (s: State, node: ts.SourceFile, queue: ts.SourceFile[]) => {
  if (s.seen.has(node) || !s.include(node)) return
  s.seen.add(node)
  s.parent = s.root
  const f = statement(s, node, 'module', { path: s.getPath(node) })
  s.parent = f.id
  node.statements.forEach((stmt) => {
    if (ts.isExportDeclaration(stmt)) return scan.ExportDeclaration(s, stmt, queue)
    scan.Statement(s, stmt)
  })
  return
}

scan.Statement = (s: State, node: ts.Statement) => {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.forEach((d) => scan.VariableDeclaration(s, d))
  }
  if (ts.isVariableDeclaration(node)) return scan.VariableDeclaration(s, node)
  if (ts.isFunctionDeclaration(node)) return scan.FunctionDeclaration(s, node)
  if (ts.isClassDeclaration(node)) return scan.ClassDeclaration(s, node)
  if (ts.isInterfaceDeclaration(node)) return scan.InterfaceDeclaration(s, node)
  if (ts.isTypeAliasDeclaration(node)) return scan.TypeAliasDeclaration(s, node)
  if (ts.isEnumDeclaration(node)) return scan.EnumDeclaration(s, node)
  if (ts.isModuleDeclaration(node)) return scan.ModuleDeclaration(s, node)
}

scan.VariableDeclaration = (s: State, node: ts.VariableDeclaration) => {
  const init = node.initializer
  if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
    return statement(s, node, 'function', functionBody(s, init))
  }
  return statement(s, node, 'variable', {
    type: node.type ? scan.Type(s, node.type) : scan.Intrinsic(s, node, 'unknown'),
    defaultValue: node.initializer?.getText(),
  })
}

scan.FunctionDeclaration = (s: State, decl: ts.FunctionDeclaration) => {
  return statement(s, decl, 'function', functionBody(s, decl))
}

scan.ClassDeclaration = (s: State, node: ts.ClassDeclaration) => {
  const constructors: T.Part<'signature'>[] = []
  const properties: T.Part<'property'>[] = []
  const methods: T.Part<'method'>[] = []
  let indexSignature: T.Part<'index-signature'> | undefined
  for (const m of node.members) {
    if (ts.isConstructorDeclaration(m)) constructors.push(signature(s, m))
    else if (ts.isPropertyDeclaration(m) && ts.isIdentifier(m.name)) properties.push(property(s, m))
    else if (ts.isMethodDeclaration(m) && ts.isIdentifier(m.name)) methods.push(method(s, m))
    else if (ts.isIndexSignatureDeclaration(m)) indexSignature = indexSignatureDecl(s, m)
  }
  return statement(s, node, 'class', {
    ...generics(s, node),
    ...heritage(s, node),
    constructors,
    properties,
    methods,
    ...(indexSignature ? { indexSignature } : {}),
  })
}

scan.InterfaceDeclaration = (s: State, node: ts.InterfaceDeclaration) =>
  statement(s, node, 'interface', {
    ...generics(s, node),
    ...interfaceExtends(s, node),
    ...objectMembers(s, node.members),
  })

scan.TypeAliasDeclaration = (s: State, node: ts.TypeAliasDeclaration) =>
  statement(s, node, 'type-alias', {
    ...generics(s, node),
    type: scan.Type(s, node.type),
  })

scan.EnumDeclaration = (s: State, node: ts.EnumDeclaration) =>
  statement(s, node, 'enum', {
    const: !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ConstKeyword),
    members: node.members.map((m) => enumMember(s, m)),
  })

scan.ModuleDeclaration = (s: State, node: ts.ModuleDeclaration) => {
  const ns = statement(s, node, 'namespace', {})
  const body = node.body
  if (!body) return ns

  const prev = s.parent
  s.parent = ns.id
  if (ts.isModuleBlock(body)) {
    body.statements.forEach((stmt) => scan.Statement(s, stmt))
  } else if (ts.isModuleDeclaration(body)) {
    // `namespace A.B { … }` → recurse on the inner `B`.
    scan.ModuleDeclaration(s, body)
  }
  s.parent = prev
  return ns
}

scan.ExportDeclaration = (s: State, node: ts.ExportDeclaration, queue: ts.SourceFile[]) => {
  const spec = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined

  // Enqueue the source module so its declarations exist for resolution.
  if (spec) {
    const sym = s.checker.getSymbolAtLocation(node.moduleSpecifier!)
    const decl = sym?.valueDeclaration ?? sym?.declarations?.[0]
    if (decl && ts.isSourceFile(decl) && !s.seen.has(decl) && s.include(decl)) {
      queue.push(decl)
    }
  }

  // Emit an `export` declaration node (ref filled by resolver).
  const exp = statement(s, node, 'export', { names: [], star: false })
  s.exports.push(exp)

  if (!node.exportClause) {
    if (!spec) return
    s.exportsForm.set(exp.id, 'star')
    s.exportsSpec.set(exp.id, spec)
    s.exportsOrigin.set(exp.id, node)
    exp.star = true
    return
  }
  if (ts.isNamespaceExport(node.exportClause)) {
    if (!spec) return
    s.exportsForm.set(exp.id, 'namespace-from')
    s.exportsSpec.set(exp.id, spec)
    s.exportsAlias.set(exp.id, node.exportClause.name.text)
    s.exportsOrigin.set(exp.id, node)
    return
  }
  const entries = node.exportClause.elements.map((el) => ({
    name: (el.propertyName ?? el.name).text,
    ...(el.propertyName ? { as: el.name.text } : {}),
  }))
  s.exportsForm.set(exp.id, spec ? 'named-from' : 'named-local')
  if (spec) s.exportsSpec.set(exp.id, spec)
  s.exportsEntries.set(exp.id, entries)
  s.exportsOrigin.set(exp.id, node)
}

// ---------------- Type Components ----------------
scan.Type = (s: State, node: ts.TypeNode): T.Type => {
  if (ts.isLiteralTypeNode(node)) return scan.Literal(s, node)
  if (ts.isArrayTypeNode(node)) return scan.Array(s, node)
  if (ts.isTupleTypeNode(node)) return scan.Tuple(s, node)
  if (ts.isUnionTypeNode(node)) return scan.Union(s, node)
  if (ts.isIntersectionTypeNode(node)) return scan.Intersection(s, node)
  if (ts.isTypeOperatorNode(node)) return scan.TypeOperator(s, node)
  if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) return scan.FunctionType(s, node)
  if (ts.isTypeLiteralNode(node)) return scan.Record(s, node)
  const name = INTRINSICS[node.kind]
  if (name) return scan.Intrinsic(s, node, name)

  if (ts.isTypeReferenceNode(node)) return scan.TypeReference(s, node)

  return scan.Unknown(s, node)
}

scan.Literal = (s: State, node: ts.LiteralTypeNode): T.Type<'literal'> =>
  type(s, node, 'literal', { value: literalValue(node.literal) })

scan.Array = (s: State, node: ts.ArrayTypeNode): T.Type<'array'> =>
  type(s, node, 'array', { elementType: scan.Type(s, node.elementType) })

scan.Union = (s: State, node: ts.UnionTypeNode): T.Type<'union'> =>
  type(s, node, 'union', { types: node.types.map((t) => scan.Type(s, t)) })

scan.Intersection = (s: State, node: ts.IntersectionTypeNode): T.Type<'intersection'> =>
  type(s, node, 'intersection', { types: node.types.map((t) => scan.Type(s, t)) })

scan.Tuple = (s: State, node: ts.TupleTypeNode): T.Type<'tuple'> =>
  type(s, node, 'tuple', { elements: node.elements.map((el) => tupleElement(s, el)) })

scan.TypeOperator = (s: State, node: ts.TypeOperatorNode): T.Type<'type-operator'> =>
  type(s, node, 'type-operator', { operator: TYPE_OPERATORS[node.operator]!, target: scan.Type(s, node.type) })

scan.FunctionType = (s: State, node: ts.FunctionTypeNode | ts.ConstructorTypeNode): T.Type<'function-type'> =>
  type(s, node, 'function-type', { signatures: [signature(s, node)] })

scan.Record = (s: State, node: ts.TypeLiteralNode): T.Type<'record'> =>
  type(s, node, 'record', objectMembers(s, node.members))

scan.TypeReference = (s: State, node: ts.TypeReferenceNode): T.Type<'reference'> => {
  const r = type(s, node, 'reference', { type: 'internal', targetId: 0 } as any)
  r.id = s.nextId()
  r.name = getName(node) ?? 'unknown'
  if (node.typeArguments?.length) r.args = node.typeArguments.map((a) => scan.Type(s, a))
  s.references.push(r)
  s.referenceOrigins.set(r.id, node)
  return r
}

scan.Unknown = (s: State, node: ts.Node): T.Type<'unknown'> =>
  type(s, node, 'unknown', { text: node.getText(), nodeType: ts.SyntaxKind[node.kind] })

scan.Intrinsic = (s: State, node: ts.Node, name: T.IntrinsicName): T.Type => {
  return type(s, node, 'intrinsic', { name })
}

scan.TypeParam = (s: State, node: ts.TypeParameterDeclaration): T.Part<'generic'> => {
  return part('generic', {
    constraint: node.constraint ? scan.Type(s, node.constraint) : undefined,
    default: node.default ? scan.Type(s, node.default) : undefined,
  })
}

// ---------------- Type Components ----------------
const signature = (s: State, node: ts.SignatureDeclarationBase): T.Part<'signature'> =>
  part('signature', {
    ...(node.typeParameters ? { generics: node.typeParameters.map((tp) => scan.TypeParam(s, tp)) } : {}),
    params: node.parameters.map((p) => parameter(s, p)),
    return: node.type ? scan.Type(s, node.type) : scan.Intrinsic(s, node, 'unknown'),
  })

const parameter = (b: State, node: ts.ParameterDeclaration): T.Part<'parameter'> =>
  part('parameter', {
    type: node.type ? scan.Type(b, node.type) : scan.Intrinsic(b, node, 'unknown'),
    optional: !!node.questionToken || !!node.initializer,
    ...(node.dotDotDotToken ? { rest: true } : {}),
    ...(node.initializer ? { default: node.initializer.getText() } : {}),
  })

const functionBody = (s: State, node: ts.SignatureDeclarationBase): T.DeclerationDefinitions['function'] => ({
  signatures: [signature(s, node)],
})

const commentForNode = (b: State, node: ts.Node): T.Comment | undefined => {
  const all = ts.getJSDocCommentsAndTags(node)
  if (!all.length) return undefined
  const parts: T.CommentPart[] = []
  const tags: T.CommentTag[] = []
  let seenBlock = false
  for (const doc of all) {
    if (!ts.isJSDoc(doc)) continue
    seenBlock = true
    appendCommentBody(doc.comment, parts)
    if (doc.tags)
      for (const t of doc.tags) {
        const tag = buildTag(b, t)
        if (tag.tag === '@module') return undefined
        tags.push(tag)
      }
  }
  if (!seenBlock) return undefined
  return { parts, ...(tags.length ? { tags } : {}) }
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
      tag: '@property',
      name: tag.name.getText(),
      type: exprType(tag.typeExpression),
      text,
    }
  }
  if (ts.isJSDocParameterTag(tag)) {
    return {
      tag: '@param',
      name: tag.name.getText(),
      type: exprType(tag.typeExpression),
      ...(tag.isBracketed ? { optional: true } : {}),
      text,
    }
  }
  if (ts.isJSDocReturnTag(tag)) {
    const type = exprType(tag.typeExpression)
    return { tag: '@returns', ...(type ? { type } : {}), text }
  }
  if (ts.isJSDocThrowsTag(tag)) {
    const type = exprType(tag.typeExpression)
    return { tag: '@throws', ...(type ? { type } : {}), text }
  }
  if (ts.isJSDocTypeTag(tag)) return { tag: '@type', type: exprType(tag.typeExpression)!, text }
  if (ts.isJSDocSatisfiesTag(tag)) return { tag: '@satisfies', type: exprType(tag.typeExpression)!, text }
  if (ts.isJSDocTemplateTag(tag)) {
    return { tag: '@template', generics: tag.typeParameters.map((tp) => scan.TypeParam(s, tp)), text }
  }
  if (ts.isJSDocSeeTag(tag)) {
    return { tag: '@see', ...(tag.name ? { target: tag.name.name.getText() } : {}), text }
  }
  if (ts.isJSDocAugmentsTag(tag)) return { tag: '@augments', class: scan.Type(s, tag.class), text }
  if (ts.isJSDocImplementsTag(tag)) return { tag: '@implements', class: scan.Type(s, tag.class), text }
  const name = '@' + tag.tagName.text
  // `@example` carries semantic indentation; re-extract from source so the
  // leader-strip never eats author tabs (see `rawTagBody`).
  if (name === '@example') return parseExample(rawTagBody(tag))
  return { tag: name, text }
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
  if (html) return { tag: '@example', caption: html[1]!.trim(), code: html[2]!.trim() }
  const fence = raw.search(/^```/m)
  if (fence > 0) {
    const caption = raw.slice(0, fence).trim()
    if (caption) return { tag: '@example', caption, code: raw.slice(fence).trim() }
  }
  return { tag: '@example', code: raw.trim() }
}
export const commentForModule = (s: State, sf: ts.SourceFile): T.Comment | undefined => {
  if (sf.statements.length === 0) return undefined
  // 1. Target the leading comment ranges for the first statement per your rules
  const sourceText = sf.getFullText()
  const commentRanges = ts.getLeadingCommentRanges(sourceText, sf.statements[0]!.pos)
  if (!commentRanges || commentRanges.length === 0) return undefined
  const parts: T.CommentPart[] = []
  const tags: T.CommentTag[] = []
  let seenBlock = false
  // 2. Evaluate each comment text range
  for (let i = 0; i < commentRanges.length; i++) {
    const range = commentRanges[i]!
    const commentText = sourceText.slice(range.pos, range.end)
    // Apply your specific layout logic
    const isModuleComment = i < commentRanges.length - 1 || commentText.includes('@module')
    if (isModuleComment) {
      // 3. Trick the compiler into parsing the raw text snippet back into an AST Node block
      // We append an empty statement (;) so the parser attaches the JSDoc to a valid target.
      const dummyFile = ts.createSourceFile(
        'dummy.ts',
        `${commentText}\n;`,
        ts.ScriptTarget.Latest,
        true, // Set parent pointers to true
      )
      // 4. Safely extract the compiled JSDoc node from the dummy file
      const dummyStmt = dummyFile.statements[0]
      if (dummyStmt) {
        const jsdocBlocks = ts.getJSDocCommentsAndTags(dummyStmt)
        const matchingBlock = jsdocBlocks.find(ts.isJSDoc) as ts.JSDoc | undefined
        if (matchingBlock) {
          seenBlock = true
          // Feed the generated AST structure down your pipeline seamlessly
          appendCommentBody(matchingBlock.comment, parts)
          if (matchingBlock.tags) {
            for (const t of matchingBlock.tags) {
              tags.push(buildTag(s, t))
            }
          }
        }
      }
    }
  }
  if (!seenBlock) return undefined
  return { parts, ...(tags.length ? { tags } : {}) }
}

const statement = <K extends keyof T.DeclarationMap>(
  s: State,
  node: ts.Node,
  kind: K,
  fields: Omit<T.DeclarationMap[K], keyof T.Base | 'kind'> & Partial<T.Base>,
): T.Declaration<K> => {
  const d = Object.assign(base(s, node), fields, { kind }) as any
  s.declarations.push(d)
  return d
}

const type = <K extends keyof T.TypeMap>(
  s: State,
  node: ts.Node,
  kind: K,
  fields: Omit<T.TypeMap[K], keyof T.Base | 'kind'> & Partial<T.Base>,
): T.Type<K> => {
  const nd = typeBase(s, node) as T.Type
  Object.assign(nd, { kind }, fields)
  return nd as any
}

const part = <K extends keyof T.PartMap>(kind: K, fields: Omit<T.PartMap[K], 'kind'>): T.Part<K> =>
  Object.assign(fields, { kind }) as any

const base = (s: State, node: ts.Node): T.Base => {
  const result: T.Base = typeBase(s, node) as any
  result.id = s.nextId()
  result.name = getName(node) ?? 'unknown'
  result.exported = isExported(node)

  const named = (node as { name?: ts.Node }).name
  const sym = s.checker.getSymbolAtLocation(named ?? node)
  if (sym) s.symbolsById.set(result.id, sym)

  return result
}

const typeBase = (s: State, node: ts.Node): T.Typebase => {
  const result: T.Typebase = { parent: s.parent, sources: [] } as T.Typebase

  const named = (node as { name?: ts.Node }).name
  const sym = s.checker.getSymbolAtLocation(named ?? node)
  if (sym?.declarations?.length) result.sources = sym.declarations!.map((d) => sourceOf(s, d))
  else result.sources = [sourceOf(s, node)]

  const comment = ts.isSourceFile(node) ? commentForModule(s, node) : commentForNode(s, node)
  if (comment) result.comment = comment

  return result
}

const sourceOf = (s: State, node: ts.Node): T.Source => {
  const sf = node.getSourceFile()
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart())
  return { file: s.getPath(sf), line: line + 1, column: character + 1 }
}

// ---------------- Utilities ----------------
export const isExported = (node: ts.Node): boolean => {
  if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) return true
  // `export const x` carries the modifier on the enclosing `VariableStatement`.
  if (ts.isVariableDeclaration(node)) {
    const stmt = node.parent?.parent
    return !!stmt && ts.isVariableStatement(stmt) && isExported(stmt)
  }
  const mods = (node as { modifiers?: ts.NodeArray<ts.ModifierLike> }).modifiers
  return !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

export const getName = (node: ts.Node): string | undefined => {
  if (ts.isTypeReferenceNode(node)) return node.typeName.getText()
  if (ts.isExpressionWithTypeArguments(node)) return node.expression.getText()
  if (ts.isTypeQueryNode(node)) return node.exprName.getText()
  if (ts.isDeclarationStatement(node)) return ts.getNameOfDeclaration(node)?.getText()
  if (ts.isExpression(node)) return ts.getNameOfDeclaration(node)?.getText()
  if ((node as { name?: ts.Node }).name) return (node as { name?: ts.Node }).name!.getText()
  return undefined
}

const property = (s: State, node: ts.PropertyDeclaration | ts.PropertySignature): T.Part<'property'> =>
  part('property', {
    type: node.type ? scan.Type(s, node.type) : scan.Intrinsic(s, node, 'unknown'),
    ...(node.questionToken ? { optional: true } : {}),
    ...('initializer' in node && node.initializer ? { defaultValue: node.initializer.getText() } : {}),
  })

const method = (s: State, node: ts.MethodDeclaration | ts.MethodSignature): T.Part<'method'> =>
  part('method', { signatures: [signature(s, node)] })

const indexSignatureDecl = (s: State, node: ts.IndexSignatureDeclaration): T.Part<'index-signature'> =>
  part('index-signature', {
    parameter: parameter(s, node.parameters[0]!),
    type: node.type ? scan.Type(s, node.type) : scan.Intrinsic(s, node, 'unknown'),
  })

const enumMember = (s: State, node: ts.EnumMember): T.Part<'enum-member'> => {
  const value = s.checker.getConstantValue(node)
  return part('enum-member', { ...(value !== undefined ? { value } : {}) })
}

const generics = (s: State, node: { typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration> }) =>
  node.typeParameters?.length ? { generics: node.typeParameters.map((tp) => scan.TypeParam(s, tp)) } : {}

const heritage = (s: State, node: ts.ClassDeclaration): { extends?: T.Type[]; implements?: T.Type[] } => {
  const out: { extends?: T.Type[]; implements?: T.Type[] } = {}
  for (const h of node.heritageClauses ?? []) {
    const types = h.types.map((t) => scan.Type(s, t))
    if (h.token === ts.SyntaxKind.ExtendsKeyword) out.extends = types
    else out.implements = types
  }
  return out
}

const interfaceExtends = (s: State, node: ts.InterfaceDeclaration): { extends?: T.Type[] } => {
  const ext = node.heritageClauses?.flatMap((h) => h.types).map((t) => scan.Type(s, t))
  return ext?.length ? { extends: ext } : {}
}

const objectMembers = (s: State, members: ts.NodeArray<ts.TypeElement>) => {
  const properties: T.Part<'property'>[] = []
  const methods: T.Part<'method'>[] = []
  const callSignatures: T.Part<'signature'>[] = []
  const constructSignatures: T.Part<'signature'>[] = []
  let indexSignature: T.Part<'index-signature'> | undefined
  for (const m of members) {
    if (ts.isPropertySignature(m) && ts.isIdentifier(m.name)) properties.push(property(s, m))
    else if (ts.isMethodSignature(m) && ts.isIdentifier(m.name)) methods.push(method(s, m))
    else if (ts.isCallSignatureDeclaration(m)) callSignatures.push(signature(s, m))
    else if (ts.isConstructSignatureDeclaration(m)) constructSignatures.push(signature(s, m))
    else if (ts.isIndexSignatureDeclaration(m)) indexSignature = indexSignatureDecl(s, m)
  }
  return {
    properties,
    methods,
    ...(callSignatures.length ? { callSignatures } : {}),
    ...(constructSignatures.length ? { constructSignatures } : {}),
    ...(indexSignature ? { indexSignature } : {}),
  }
}

const literalValue = (lit: ts.Node): T.Type<'literal'>['value'] => {
  if (lit.kind === ts.SyntaxKind.NullKeyword) return null
  if (ts.isStringLiteral(lit)) return lit.text
  if (ts.isNumericLiteral(lit)) return Number(lit.text)
  if (lit.kind === ts.SyntaxKind.TrueKeyword) return true
  if (lit.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isBigIntLiteral(lit)) return BigInt(lit.text.replace(/n$/, ''))
  return lit.getText()
}

const tupleElement = (s: State, el: ts.TypeNode): T.Part<'tuple-element'> => {
  if (ts.isNamedTupleMember(el))
    return part('tuple-element', {
      type: scan.Type(s, el.type),
      ...(el.questionToken ? { optional: true } : {}),
      ...(el.dotDotDotToken ? { rest: true } : {}),
    })
  if (ts.isOptionalTypeNode(el)) return part('tuple-element', { type: scan.Type(s, el.type), optional: true })
  if (ts.isRestTypeNode(el)) return part('tuple-element', { type: scan.Type(s, el.type), rest: true })
  return part('tuple-element', { type: scan.Type(s, el) })
}

const INTRINSICS: Partial<Record<ts.SyntaxKind, T.IntrinsicName>> = {
  [ts.SyntaxKind.StringKeyword]: 'string',
  [ts.SyntaxKind.NumberKeyword]: 'number',
  [ts.SyntaxKind.BooleanKeyword]: 'boolean',
  [ts.SyntaxKind.BigIntKeyword]: 'bigint',
  [ts.SyntaxKind.SymbolKeyword]: 'symbol',
  [ts.SyntaxKind.VoidKeyword]: 'void',
  [ts.SyntaxKind.UndefinedKeyword]: 'undefined',
  [ts.SyntaxKind.NeverKeyword]: 'never',
  [ts.SyntaxKind.AnyKeyword]: 'any',
  [ts.SyntaxKind.UnknownKeyword]: 'unknown',
  [ts.SyntaxKind.ObjectKeyword]: 'object',
}

const TYPE_OPERATORS: Partial<Record<ts.SyntaxKind, 'keyof' | 'readonly' | 'unique'>> = {
  [ts.SyntaxKind.KeyOfKeyword]: 'keyof',
  [ts.SyntaxKind.ReadonlyKeyword]: 'readonly',
  [ts.SyntaxKind.UniqueKeyword]: 'unique',
}
