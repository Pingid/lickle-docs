import ts from 'typescript'

import { type ScanState as State } from '../state.ts'
import type * as T from '../types.ts'
import * as Make from './make.ts'
import * as Type from './type.ts'
import * as Ast from './ast.ts'

type Gen = Generator<T.Declaration, void, void>

export const ExportDeclaration = function* (s: State, node: ts.ExportDeclaration): Gen {
  const spec = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined

  if (spec) {
    const sym = s.checker.getSymbolAtLocation(node.moduleSpecifier!)
    const decl = sym?.valueDeclaration ?? sym?.declarations?.[0]
    if (decl && ts.isSourceFile(decl) && !s.seen.has(decl) && s.include(decl)) s.files.push(decl)
  }

  const dec = Make.statement(s, node, 'export', () => ({ names: [], star: false }))
  s.exports.add(dec)

  if (!node.exportClause) {
    if (spec) {
      s.exportsForm.set(dec.id, 'star')
      s.exportsSpec.set(dec.id, spec)
      s.exportsOrigin.set(dec.id, node)
      dec.star = true
    }
    return yield dec
  }
  if (ts.isNamespaceExport(node.exportClause)) {
    if (spec) {
      s.exportsForm.set(dec.id, 'namespace-from')
      s.exportsSpec.set(dec.id, spec)
      s.exportsAlias.set(dec.id, node.exportClause.name.text)
      s.exportsOrigin.set(dec.id, node)
    }
    return yield dec
  }
  const entries = node.exportClause.elements.map((el) => ({
    name: (el.propertyName ?? el.name).text,
    ...(el.propertyName ? { as: el.name.text } : {}),
    type: node.isTypeOnly || el.isTypeOnly,
  }))
  s.exportsForm.set(dec.id, spec ? 'named-from' : 'named-local')
  if (spec) s.exportsSpec.set(dec.id, spec)
  s.exportsEntries.set(dec.id, entries)
  s.exportsOrigin.set(dec.id, node)
  yield dec
}

export const ExportAssignment = function* (s: State, node: ts.ExportAssignment): Gen {
  const exp = Make.statement(s, node, 'export', () => ({ names: [], star: false }))
  s.exports.add(exp)
  s.exportsForm.set(exp.id, 'assignment')
  s.exportsOrigin.set(exp.id, node)
  yield exp
}

export const VariableStatement = function* (s: State, node: ts.VariableStatement): Gen {
  for (const d of node.declarationList.declarations) yield* VariableDeclaration(s, d)
}

export const VariableDeclaration = function* (s: State, node: ts.VariableDeclaration): Gen {
  const annotated = node.type && Ast.callSignaturesOf(node.type)
  if (annotated?.length) {
    yield Make.statement(s, node, 'function', () => ({ signatures: annotated.map((d) => Type.signature(s, d)) }))
    return
  }
  const init = node.initializer
  if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
    yield Make.statement(s, node, 'function', () => functionBody(s, init))
    return
  }
  yield Make.statement(s, node, 'variable', () => ({
    type: node.type ? Type.Type(s, node.type) : Type.inferAt(s, node),
    defaultValue: defaultValueOf(node.initializer),
  }))
}

export const FunctionDeclaration = function* (s: State, decl: ts.FunctionDeclaration): Gen {
  const sym = decl.name ? s.checker.getSymbolAtLocation(decl.name) : undefined
  const overloads = sym?.declarations?.filter(ts.isFunctionDeclaration) ?? [decl]
  if (overloads.length > 1 && overloads[0] !== decl) return
  const sigs = overloads.filter((d) => !d.body)
  const chosen = sigs.length ? sigs : overloads
  yield Make.statement(s, decl, 'function', () => ({ signatures: chosen.map((d) => Type.signature(s, d)) }))
}

export const ClassDeclaration = function* (s: State, node: ts.ClassDeclaration): Gen {
  const members: T.Member[] = []
  for (const m of node.members) {
    if (ts.isConstructorDeclaration(m)) members.push({ ...Type.signature(s, m), construct: true })
    else if (ts.isPropertyDeclaration(m) && ts.isIdentifier(m.name)) members.push(classProperty(s, m))
    else if (ts.isMethodDeclaration(m) && ts.isIdentifier(m.name)) members.push(classMethod(s, m))
    else if (ts.isIndexSignatureDeclaration(m)) members.push(classIndexSignature(s, m))
  }
  yield Make.statement(s, node, 'class', () => ({
    ...generics(s, node),
    ...heritage(s, node),
    members,
  }))
}

export const InterfaceDeclaration = function* (s: State, node: ts.InterfaceDeclaration): Gen {
  yield Make.statement(s, node, 'interface', () => ({
    ...generics(s, node),
    ...interfaceExtends(s, node),
    members: Type.objectMembers(s, node.members),
  }))
}

export const TypeAliasDeclaration = function* (s: State, node: ts.TypeAliasDeclaration): Gen {
  yield Make.statement(s, node, 'type-alias', () => ({
    ...generics(s, node),
    type: Type.Type(s, node.type),
  }))
}

export const EnumDeclaration = function* (s: State, node: ts.EnumDeclaration): Gen {
  yield Make.statement(s, node, 'enum', () => ({
    const: !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ConstKeyword),
    members: node.members.map((m) => enumMember(s, m)),
  }))
}

const functionBody = (s: State, node: ts.SignatureDeclarationBase): { signatures: T.Part<'signature'>[] } => ({
  signatures: [Type.signature(s, node)],
})

const classProperty = (s: State, node: ts.PropertyDeclaration): T.Part<'property'> =>
  Make.part(s, node, 'property', {
    type: node.type ? Type.Type(s, node.type) : Type.inferAt(s, node),
    ...(node.questionToken ? { optional: true } : {}),
    ...(node.initializer ? { defaultValue: defaultValueOf(node.initializer) } : {}),
  })

const classMethod = (s: State, node: ts.MethodDeclaration): T.Part<'method'> =>
  Make.part(s, node, 'method', { signatures: [Type.signature(s, node)] })

const classIndexSignature = (s: State, node: ts.IndexSignatureDeclaration): T.Part<'index-signature'> =>
  Make.part(s, node, 'index-signature', {
    parameter: Type.parameter(s, node.parameters[0]!),
    type: node.type ? Type.Type(s, node.type) : Type.Intrinsic(s, node, 'unknown'),
  })

const enumMember = (s: State, node: ts.EnumMember): T.Part<'enum-member'> => {
  const value = s.checker.getConstantValue(node)
  return Make.part(s, node, 'enum-member', { ...(value !== undefined ? { value } : {}) })
}

const generics = (s: State, node: { typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration> }) =>
  node.typeParameters?.length ? { generics: node.typeParameters.map((tp) => Type.TypeParam(s, tp)) } : {}

const heritage = (s: State, node: ts.ClassDeclaration): { extends?: T.Type[]; implements?: T.Type[] } => {
  const out: { extends?: T.Type[]; implements?: T.Type[] } = {}
  for (const h of node.heritageClauses ?? []) {
    const types = h.types.map((t) => Type.Type(s, t))
    if (h.token === ts.SyntaxKind.ExtendsKeyword) out.extends = types
    else out.implements = types
  }
  return out
}

const interfaceExtends = (s: State, node: ts.InterfaceDeclaration): { extends?: T.Type[] } => {
  const ext = node.heritageClauses?.flatMap((h) => h.types).map((t) => Type.Type(s, t))
  return ext?.length ? { extends: ext } : {}
}

const defaultValueOf = (init?: ts.Expression): string | undefined => {
  const text = init?.getText()
  if (!text || text.length > 80 || text.includes('\n')) return undefined
  return text
}
