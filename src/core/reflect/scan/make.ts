import ts from 'typescript'

import type * as context from '../graph/index.ts'
import type * as T from '../types.ts'

// ---------------- Transform Helpers ----------------
/** Convert a syntactic type node into its reflection `Type`. */
export const typeOf = (b: context.Builder, node: ts.TypeNode): T.Type => {
  if (ts.isLiteralTypeNode(node)) return literal(b, node)
  if (ts.isArrayTypeNode(node)) return array(b, node)
  if (ts.isTupleTypeNode(node)) return tuple(b, node)
  if (ts.isUnionTypeNode(node)) return union(b, node)
  if (ts.isIntersectionTypeNode(node)) return intersection(b, node)
  if (ts.isTypeOperatorNode(node)) return typeOperator(b, node)
  if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) return functionType(b, node)
  if (ts.isTypeLiteralNode(node)) return reflection(b, node)
  const name = INTRINSICS[node.kind]
  if (name) return intrinsic(b, node, name)

  if (ts.isTypeReferenceNode(node)) return typeOfReference(b, node)

  return unknown(b, node)
}

const typeOfReference = (b: context.Builder, node: ts.TypeReferenceNode): T.Type<'reference'> => {
  const symbol = symbolAt(b, node.typeName)
  const first = symbol?.first ? symbol.first : undefined
  if (first) {
    if (ts.isDeclarationStatement(first)) return b.reference(node, first, reference(b, node))
  }
  return b.reference(node, null, reference(b, node))
}

// ---------------- Type Nodes ----------------
const intrinsic = (b: context.Builder, node: ts.Node, name: T.IntrinsicName): T.Type<'intrinsic'> =>
  kind(b, node, 'intrinsic', { name })

const literal = (b: context.Builder, node: ts.LiteralTypeNode): T.Type<'literal'> =>
  kind(b, node, 'literal', { value: literalValue(node.literal) })

const array = (b: context.Builder, node: ts.ArrayTypeNode): T.Type<'array'> =>
  kind(b, node, 'array', { elementType: typeOf(b, node.elementType) })

const union = (b: context.Builder, node: ts.UnionTypeNode): T.Type<'union'> =>
  kind(b, node, 'union', { types: node.types.map((t) => typeOf(b, t)) })

const intersection = (b: context.Builder, node: ts.IntersectionTypeNode): T.Type<'intersection'> =>
  kind(b, node, 'intersection', { types: node.types.map((t) => typeOf(b, t)) })

const tuple = (b: context.Builder, node: ts.TupleTypeNode): T.Type<'tuple'> =>
  kind(b, node, 'tuple', { elements: node.elements.map((el) => tupleElement(b, el)) })

const typeOperator = (b: context.Builder, node: ts.TypeOperatorNode): T.Type<'type-operator'> =>
  kind(b, node, 'type-operator', { operator: TYPE_OPERATORS[node.operator]!, target: typeOf(b, node.type) })

const functionType = (
  b: context.Builder,
  node: ts.FunctionTypeNode | ts.ConstructorTypeNode,
): T.Type<'function-type'> => kind(b, node, 'function-type', { signatures: [signature(b, node)] })

export const reference = (
  b: context.Builder,
  node: ts.TypeReferenceNode | ts.ExpressionWithTypeArguments | ts.TypeNode,
): T.Type<'reference'> => {
  const r = kind(b, node, 'reference', {})
  if ('typeArguments' in node && node.typeArguments?.length) {
    r.typeArguments = node.typeArguments.map((a) => typeOf(b, a))
  }
  return r
}

const referenceTarget = (node: ts.Node): ts.Node | undefined => {
  if (ts.isImportDeclaration(node)) return node.moduleSpecifier
  if (ts.isImportSpecifier(node)) return node.name
  return node
}

const reflection = (b: context.Builder, node: ts.TypeLiteralNode): T.Type<'reflection'> =>
  kind(b, node, 'reflection', objectMembers(b, node.members))

const unknown = (b: context.Builder, node: ts.Node): T.Type<'unknown'> =>
  kind(b, node, 'unknown', { text: node.getText(), nodeType: nodeTypeName(node) })

// ---------------- Type Components ----------------
const signature = (b: context.Builder, node: ts.SignatureDeclarationBase): T.Part<'signature'> =>
  part('signature', {
    ...(node.typeParameters ? { generics: node.typeParameters.map((tp) => generic(b, tp)) } : {}),
    params: node.parameters.map((p) => parameter(b, p)),
    return: node.type ? typeOf(b, node.type) : intrinsic(b, node, 'unknown'),
  })

const parameter = (b: context.Builder, node: ts.ParameterDeclaration): T.Part<'parameter'> =>
  part('parameter', {
    type: node.type ? typeOf(b, node.type) : intrinsic(b, node, 'unknown'),
    optional: !!node.questionToken || !!node.initializer,
    ...(node.dotDotDotToken ? { rest: true } : {}),
    ...(node.initializer ? { default: node.initializer.getText() } : {}),
  })

const generic = (b: context.Builder, node: ts.TypeParameterDeclaration): T.Part<'generic'> =>
  part('generic', {
    ...(node.constraint ? { constraint: typeOf(b, node.constraint) } : {}),
    ...(node.default ? { default: typeOf(b, node.default) } : {}),
  })

const tupleElement = (b: context.Builder, el: ts.TypeNode): T.Part<'tuple-element'> => {
  if (ts.isNamedTupleMember(el))
    return part('tuple-element', {
      type: typeOf(b, el.type),
      ...(el.questionToken ? { optional: true } : {}),
      ...(el.dotDotDotToken ? { rest: true } : {}),
    })
  if (ts.isOptionalTypeNode(el)) return part('tuple-element', { type: typeOf(b, el.type), optional: true })
  if (ts.isRestTypeNode(el)) return part('tuple-element', { type: typeOf(b, el.type), rest: true })
  return part('tuple-element', { type: typeOf(b, el) })
}

// ---------------- Members ----------------
const property = (b: context.Builder, node: ts.PropertyDeclaration | ts.PropertySignature): T.Part<'property'> =>
  part('property', {
    type: node.type ? typeOf(b, node.type) : intrinsic(b, node, 'unknown'),
    ...(node.questionToken ? { optional: true } : {}),
    ...('initializer' in node && node.initializer ? { defaultValue: node.initializer.getText() } : {}),
  })

const method = (b: context.Builder, node: ts.MethodDeclaration | ts.MethodSignature): T.Part<'method'> =>
  part('method', { signatures: [signature(b, node)] })

const indexSignature = (b: context.Builder, node: ts.IndexSignatureDeclaration): T.Part<'index-signature'> =>
  part('index-signature', {
    parameter: parameter(b, node.parameters[0]!),
    type: node.type ? typeOf(b, node.type) : intrinsic(b, node, 'unknown'),
  })

const enumMember = (b: context.Builder, node: ts.EnumMember): T.Part<'enum-member'> => {
  const value = b.checker.getConstantValue(node)
  return part('enum-member', { ...(value !== undefined ? { value } : {}) })
}

/** Optional `generics` field from a node's type parameters. */
const generics = (b: context.Builder, node: { typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration> }) =>
  node.typeParameters?.length ? { generics: node.typeParameters.map((tp) => generic(b, tp)) } : {}

/** `extends`/`implements` heritage of a class. */
const heritage = (b: context.Builder, node: ts.ClassDeclaration): { extends?: T.Type[]; implements?: T.Type[] } => {
  const out: { extends?: T.Type[]; implements?: T.Type[] } = {}
  for (const h of node.heritageClauses ?? []) {
    const types = h.types.map((t) => typeOf(b, t))
    if (h.token === ts.SyntaxKind.ExtendsKeyword) out.extends = types
    else out.implements = types
  }
  return out
}

/** `extends` of an interface (all heritage clauses are `extends`). */
const interfaceExtends = (b: context.Builder, node: ts.InterfaceDeclaration): { extends?: T.Type[] } => {
  const ext = node.heritageClauses?.flatMap((h) => h.types).map((t) => typeOf(b, t))
  return ext?.length ? { extends: ext } : {}
}

// ---------------- Declaration Bodies ----------------
export const variableBody = (b: context.Builder, n: ts.VariableDeclaration): T.DeclerationDefinitions['variable'] => ({
  type: n.type ? typeOf(b, n.type) : intrinsic(b, n, 'unknown'),
  ...(n.initializer ? { defaultValue: n.initializer.getText() } : {}),
})

export const functionBody = (
  b: context.Builder,
  n: ts.SignatureDeclarationBase,
): T.DeclerationDefinitions['function'] => ({
  signatures: [signature(b, n)],
})

export const classBody = (b: context.Builder, n: ts.ClassDeclaration): T.DeclerationDefinitions['class'] => {
  const constructors: T.Part<'signature'>[] = []
  const properties: T.Part<'property'>[] = []
  const methods: T.Part<'method'>[] = []
  let index: T.Part<'index-signature'> | undefined
  for (const m of n.members) {
    if (ts.isConstructorDeclaration(m)) constructors.push(signature(b, m))
    else if (ts.isPropertyDeclaration(m) && ts.isIdentifier(m.name)) properties.push(property(b, m))
    else if (ts.isMethodDeclaration(m) && ts.isIdentifier(m.name)) methods.push(method(b, m))
    else if (ts.isIndexSignatureDeclaration(m)) index = indexSignature(b, m)
  }
  return {
    ...generics(b, n),
    ...heritage(b, n),
    constructors,
    properties,
    methods,
    ...(index ? { indexSignature: index } : {}),
  }
}

export const interfaceBody = (
  b: context.Builder,
  n: ts.InterfaceDeclaration,
): T.DeclerationDefinitions['interface'] => ({
  ...generics(b, n),
  ...interfaceExtends(b, n),
  ...objectMembers(b, n.members),
})

/** Partition the members shared by interfaces, type literals, and object types. */
const objectMembers = (b: context.Builder, members: ts.NodeArray<ts.TypeElement>) => {
  const properties: T.Part<'property'>[] = []
  const methods: T.Part<'method'>[] = []
  const callSignatures: T.Part<'signature'>[] = []
  const constructSignatures: T.Part<'signature'>[] = []
  let index: T.Part<'index-signature'> | undefined
  for (const m of members) {
    if (ts.isPropertySignature(m) && ts.isIdentifier(m.name)) properties.push(property(b, m))
    else if (ts.isMethodSignature(m) && ts.isIdentifier(m.name)) methods.push(method(b, m))
    else if (ts.isCallSignatureDeclaration(m)) callSignatures.push(signature(b, m))
    else if (ts.isConstructSignatureDeclaration(m)) constructSignatures.push(signature(b, m))
    else if (ts.isIndexSignatureDeclaration(m)) index = indexSignature(b, m)
  }
  return {
    properties,
    methods,
    ...(callSignatures.length ? { callSignatures } : {}),
    ...(constructSignatures.length ? { constructSignatures } : {}),
    ...(index ? { indexSignature: index } : {}),
  }
}

export const aliasBody = (b: context.Builder, n: ts.TypeAliasDeclaration): T.DeclerationDefinitions['type-alias'] => ({
  ...generics(b, n),
  type: typeOf(b, n.type),
})

export const enumBody = (b: context.Builder, n: ts.EnumDeclaration): T.DeclerationDefinitions['enum'] => ({
  const: !!n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ConstKeyword),
  members: n.members.map((m) => enumMember(b, m)),
})

/** Parse a literal type node's payload into its primitive value. */
const literalValue = (lit: ts.Node): T.Type<'literal'>['value'] => {
  if (lit.kind === ts.SyntaxKind.NullKeyword) return null
  if (ts.isStringLiteral(lit)) return lit.text
  if (ts.isNumericLiteral(lit)) return Number(lit.text)
  if (lit.kind === ts.SyntaxKind.TrueKeyword) return true
  if (lit.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isBigIntLiteral(lit)) return BigInt(lit.text.replace(/n$/, ''))
  return lit.getText()
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

// ---------------- Node Construction Helpers ----------------
export const decl = <K extends keyof T.DeclarationMap>(
  b: context.Builder,
  node: ts.Node,
  kind: K,
  fields: Omit<T.DeclarationMap[K], keyof T.Base | 'kind'> & Partial<T.Base>,
): T.Declaration<K> => {
  const nd = typebase(b, node) as T.Declaration
  nd.name = getName(node) ?? 'unknown'
  nd.kind = kind
  nd.exported = isExported(node)
  Object.assign(nd, fields)
  return nd as any
}

export const kind = <K extends keyof T.TypeMap>(
  b: context.Builder,
  node: ts.Node,
  kind: K,
  fields: Omit<T.TypeMap[K], keyof T.Base | 'kind'>,
): T.TypeMap[K] => {
  const nd = typebase(b, node)
  Object.assign(nd, { kind }, fields)
  return nd as any
}

export const part = <K extends keyof T.PartMap>(kind: K, fields: Omit<T.PartMap[K], 'kind'>): T.PartMap[K] =>
  Object.assign(fields, { kind }) as any

const typebase = (b: context.Builder, node: ts.Node): T.Typebase => {
  const result: T.Typebase = {} as T.Typebase

  const named = (node as { name?: ts.Node }).name
  const sym = b.checker.getSymbolAtLocation(named ?? node)
  if (sym?.declarations?.length) result.sources = sym.declarations!.map((d) => sourceOf(b, d))
  else result.sources = [sourceOf(b, node)]

  const comment = ts.isSourceFile(node) ? commentForModule(b, node) : commentForNode(b, node)
  if (comment) result.comment = comment

  // result.name = getName(node) ?? 'unknown'

  return result
}

const sourceOf = (b: context.Builder, node: ts.Node): T.Source => {
  const sf = node.getSourceFile()
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart())
  return { file: b.path(sf), line: line + 1, column: character + 1 }
}

// ---------------- Comments ----------------
const commentForNode = (b: context.Builder, node: ts.Node): T.Comment | undefined => {
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
const buildTag = (b: context.Builder, tag: ts.JSDocTag): T.CommentTag => {
  const text = ts.getTextOfJSDocComment(tag.comment)?.trim() ?? ''
  const exprType = (te?: ts.JSDocTypeExpression) => (te ? typeOf(b, te.type) : undefined)
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
    return { tag: '@template', generics: tag.typeParameters.map((tp) => generic(b, tp)), text }
  }
  if (ts.isJSDocSeeTag(tag)) {
    return { tag: '@see', ...(tag.name ? { target: tag.name.name.getText() } : {}), text }
  }
  if (ts.isJSDocAugmentsTag(tag)) return { tag: '@augments', class: typeOf(b, tag.class), text }
  if (ts.isJSDocImplementsTag(tag)) return { tag: '@implements', class: typeOf(b, tag.class), text }
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
export const commentForModule = (b: context.Builder, sf: ts.SourceFile): T.Comment | undefined => {
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
              tags.push(buildTag(b, t))
            }
          }
        }
      }
    }
  }
  if (!seenBlock) return undefined
  return { parts, ...(tags.length ? { tags } : {}) }
}

// ---------------- Ast utils ----------------
export const findSourceSymbol = (b: context.Builder, symbol?: ts.Symbol): ts.Symbol | undefined => {
  let currentSymbol = symbol
  const visited = new Set<ts.Symbol>()

  while (currentSymbol && currentSymbol.flags & ts.SymbolFlags.Alias) {
    // Guard against circular alias chains
    if (visited.has(currentSymbol)) {
      break
    }
    visited.add(currentSymbol)

    // Step backward through the alias chain
    const next = b.checker.getImmediateAliasedSymbol(currentSymbol)
    if (next) {
      currentSymbol = next
    } else {
      break
    }
  }

  return currentSymbol
}

/**
 * Wrapper specifically designed to kick off the search from an ExportSpecifier node
 */
export const getSourceSymbolFromExport = (b: context.Builder, node: ts.ExportSpecifier): ts.Symbol | undefined => {
  const targetNode = node.propertyName ?? node.name
  const initialSymbol = b.checker.getSymbolAtLocation(targetNode)
  return findSourceSymbol(b, initialSymbol)
}

export const symbolSourceFile = (symbol?: ts.Symbol): ts.SourceFile | undefined =>
  symbol?.declarations?.find(ts.isSourceFile) || symbol?.declarations?.[0]?.getSourceFile()

export const symbolDeclarations = (b: context.Builder, node: ts.Node): ts.Node[] => {
  const sym = b.checker.getSymbolAtLocation(node)
  if (sym) return sym.declarations ?? []
  return []
}

export const symbolAt = (
  b: context.Builder,
  node: ts.Node,
):
  | { symbol: ts.Symbol; sourceFile: ts.SourceFile; declarations: ts.Node[]; first: ts.Node | undefined }
  | undefined => {
  const sym = findSourceSymbol(b, b.checker.getSymbolAtLocation(node))
  if (sym) {
    const sourceFile = symbolSourceFile(sym)
    if (sourceFile) {
      const declarations = (sym.declarations ?? []).map(findSourceDeclaration)
      return { symbol: sym, sourceFile: sourceFile, declarations: declarations, first: declarations[0] }
    }
  }
  return undefined
}

const findSourceDeclaration = (decl: ts.Declaration): ts.Declaration => {
  if (ts.isImportSpecifier(decl)) return decl.name
  return decl
}

const findSource = (node: ts.Node): ts.Node => {
  if (ts.isImportSpecifier(node)) return findSource(node.name)
  return node
}

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

const getName = (node: ts.Node): string | undefined => {
  if (ts.isTypeReferenceNode(node)) return node.typeName.getText()
  if (ts.isExpressionWithTypeArguments(node)) return node.expression.getText()
  if (ts.isTypeQueryNode(node)) return node.exprName.getText()
  if (ts.isDeclarationStatement(node)) return ts.getNameOfDeclaration(node)?.getText()
  if (ts.isExpression(node)) return ts.getNameOfDeclaration(node)?.getText()
  if ((node as { name?: ts.Node }).name) return (node as { name?: ts.Node }).name!.getText()
  return undefined
}

export const nodeTypeName = (node?: ts.Node): string => {
  if (!node) return 'undefined'
  const kindName = ts.SyntaxKind[node.kind]
  if ('name' in node && node.name && ts.isIdentifier(node.name as ts.Node))
    return `${kindName} (${(node.name as ts.Identifier).text})`
  return `${kindName} (anonymous)`
}
