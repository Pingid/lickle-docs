import ts from 'typescript'
import path from 'path'

import type * as T from './types.ts'

/** How a given `exports` clause should populate its targets at resolve time. */
export type ExportsForm = 'named-local' | 'named-from' | 'star' | 'namespace-from' | 'assignment'

export interface ScanOptions {
  rootDir: string
  /** The compiler options for the project. */
  compilerOptions: ts.CompilerOptions
  /** Whether to include a file in the scan. */
  include: (sf: ts.SourceFile) => boolean
}

export interface ScanContext extends ScanState {
  nextId: () => number
  // getPath: (sf: ts.SourceFile) => string
  getModule: (sf: ts.SourceFile, make: (path: string) => T.Module) => T.Module
  // sourceOf: (node: ts.Node) => T.Source
  // getFile: (sf: ts.SourceFile) => number
}

export const makeScanContext = (checker: ts.TypeChecker, options: ScanOptions): ScanContext => {
  const s = makeScanState(checker, options)
  let id = 0
  // const getPath = (sf: ts.SourceFile) => relPath.get(sf) ?? path.relative(options.rootDir, sf.fileName)
  const getModule = (sf: ts.SourceFile, make: (path: string) => T.Module) => {
    let m = s.modByFile.get(sf)
    if (!m) {
      s.modByFile.set(sf, (m = make(path.relative(options.rootDir, sf.fileName))))
      s.modules.set(m.id, m)
    }
    return m
  }

  const api: Omit<ScanContext, keyof ScanState> = {
    nextId: () => ++id,
    getModule,
  }
  return Object.assign(s, api)
}

export interface ScanState extends ScanOptions {
  root: number
  parent: number
  currentStmt: number

  checker: ts.TypeChecker
  references: T.Type<'reference'>[]
  exports: T.Declaration<'export'>[]

  modByFile: WeakMap<ts.SourceFile, T.Module>

  modules: Map<number, T.Module>
  comments: Map<number, T.Comment>
  sources: Map<number, T.Source[]>
  declarations: Map<number, T.Declaration>

  symbolsById: Map<number, ts.Symbol>
  referenceOrigins: Map<number, ts.Node>
  /** Symbol for inferred references, which have no syntactic origin to re-resolve. */
  referenceSymbols: Map<number, ts.Symbol>

  // ---- deferred export population ----
  /** exports id -> which population strategy resolve should use. */
  exportsForm: Map<number, ExportsForm>
  /** exports id -> source module specifier text, for the `*-from` forms. */
  exportsSpec: Map<number, string>
  /** exports id -> raw `{ name, as? }` entries, for the `named-*` forms. */
  exportsEntries: Map<number, { name: string; as?: string }[]>
  /** exports id -> alias, for `export * as <alias> from '…'`. */
  exportsAlias: Map<number, string>
  /** exports id -> origin node, so resolve can re-ask the checker. */
  exportsOrigin: Map<number, ts.ExportDeclaration | ts.ExportAssignment>

  /** Source files already scanned — dedups the transitive re-export worklist. */
  seen: Set<ts.SourceFile>
}

export const makeScanState = (checker: ts.TypeChecker, options: ScanOptions): ScanState => {
  return {
    ...options,
    root: 0,
    parent: 0,
    currentStmt: 0,
    checker,
    modByFile: new WeakMap(),
    modules: new Map(),
    comments: new Map(),
    sources: new Map(),
    references: [],
    exports: [],
    declarations: new Map(),
    symbolsById: new Map(),
    referenceOrigins: new Map(),
    referenceSymbols: new Map(),
    exportsForm: new Map(),
    exportsSpec: new Map(),
    exportsEntries: new Map(),
    exportsAlias: new Map(),
    exportsOrigin: new Map(),
    seen: new Set(),
  }
}
