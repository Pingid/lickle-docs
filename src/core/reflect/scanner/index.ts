import ts from 'typescript'

import { type ScanState as State } from '../state.ts'
import * as Stmt from './statement.ts'
import type * as T from '../types.ts'
import * as Make from './make.ts'

type Gen = Generator<T.Declaration, void, void>

/** Walk all files in `s.files`, yielding each declaration. Grows the worklist via re-exports. */
export const scan = function* (s: State): Gen {
  let i = 0
  while (i < s.files.length) {
    s.emit({ level: 'info', code: 'scan-file-start', message: `Scanning file ${s.files[i]!.fileName}` })
    yield* SourceFile(s, s.files[i]!)
    s.emit({ level: 'info', code: 'scan-file-end', message: `Finished scanning file ${s.files[i]!.fileName}` })
    i++
  }
}

const SourceFile = function* (s: State, node: ts.SourceFile): Gen {
  if (s.seen.has(node) || !s.include(node)) return
  s.parent = s.root
  s.seen.add(node)

  const dec = Make.statement(s, node, 'module', () => ({ path: s.getPath(node) }))
  yield dec
  for (const stmt of node.statements) {
    s.parent = dec.id
    yield* Statement(s, stmt)
  }
}

const Statement = function* (s: State, node: ts.Statement): Gen {
  if (ts.isModuleDeclaration(node)) return yield* Module(s, node)
  if (ts.isExportDeclaration(node)) return yield* Stmt.ExportDeclaration(s, node)
  if (ts.isExportAssignment(node)) return yield* Stmt.ExportAssignment(s, node)
  if (ts.isVariableStatement(node)) return yield* Stmt.VariableStatement(s, node)
  if (ts.isVariableDeclaration(node)) return yield* Stmt.VariableDeclaration(s, node)
  if (ts.isFunctionDeclaration(node)) return yield* Stmt.FunctionDeclaration(s, node)
  if (ts.isClassDeclaration(node)) return yield* Stmt.ClassDeclaration(s, node)
  if (ts.isInterfaceDeclaration(node)) return yield* Stmt.InterfaceDeclaration(s, node)
  if (ts.isTypeAliasDeclaration(node)) return yield* Stmt.TypeAliasDeclaration(s, node)
  if (ts.isEnumDeclaration(node)) return yield* Stmt.EnumDeclaration(s, node)
}

const Module = function* (s: State, node: ts.ModuleDeclaration): Gen {
  const ns = Make.statement(s, node, 'namespace', () => ({}))
  yield ns

  const body = node.body
  if (!body) return

  const prev = s.parent
  s.parent = ns.id

  if (ts.isModuleBlock(body)) {
    for (const stmt of body.statements) {
      s.parent = ns.id
      yield* Statement(s, stmt)
    }
  } else if (ts.isModuleDeclaration(body)) {
    yield* Module(s, body)
  }

  s.parent = prev
}
