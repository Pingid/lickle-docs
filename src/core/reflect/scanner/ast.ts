import ts from 'typescript'

/** Signature declarations of a function-type or a pure call-signature object type. */
export const callSignaturesOf = (node: ts.TypeNode): ts.SignatureDeclarationBase[] | undefined => {
  const t = ts.isParenthesizedTypeNode(node) ? node.type : node
  if (ts.isFunctionTypeNode(t)) return [t]
  if (ts.isTypeLiteralNode(t)) {
    const calls = t.members.filter(ts.isCallSignatureDeclaration)
    if (calls.length && calls.length === t.members.length) return calls
  }
  return undefined
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

export const isExported = (node: ts.Node): boolean => {
  if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) return true
  if (ts.isVariableDeclaration(node)) {
    const stmt = node.parent?.parent
    return !!stmt && ts.isVariableStatement(stmt) && isExported(stmt)
  }
  const mods = (node as { modifiers?: ts.NodeArray<ts.ModifierLike> }).modifiers
  return !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

export const KindName = (node: ts.Node): string => {
  const kindName = ts.SyntaxKind[node.kind]
  if ('name' in node && node.name && ts.isIdentifier(node.name as ts.Node))
    return `${kindName} (${(node.name as ts.Identifier).text})`
  return `${kindName} (anonymous)`
}
