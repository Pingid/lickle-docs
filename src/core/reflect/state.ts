import ts from 'typescript'
import path from 'path'

import type * as T from './types.ts'

/** How a given `exports` clause should populate its targets at resolve time. */
export type ExportsForm = 'named-local' | 'named-from' | 'star' | 'namespace-from' | 'assignment'

export interface ScanOptions {
  cmd: ts.ParsedCommandLine
  dir: string
  srcDir: string
  include: (sf: ts.SourceFile) => boolean
}

export interface ScanState extends ScanOptions {
  checker: ts.TypeChecker
  compilerOptions: ts.CompilerOptions

  /** Declarations found in the source files. */
  declarations: T.Declaration[]

  /** Monotonic id source. Every node that needs identity calls this. */
  nextId: () => number
  getPath: (sf: ts.SourceFile) => string
  root: number
  parent: number
  currentStmt: number
  srcDir: string

  /** References to other declarations. resolved later. */
  references: T.Type<'reference'>[]
  /** Export declarations, which are populated later. */
  exports: T.Declaration<'export'>[]

  /** Symbols by id. Used to resolve references. */
  symbolsById: Map<number, ts.Symbol>
  /** Reference origins, used to re-resolve references. */
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

  // Meta info used down stream
  /** Languages found in the source file @example code blocks. */
  langs: Set<string>
}

export const makeScanState = (checker: ts.TypeChecker, options: ScanOptions): ScanState => {
  const relPath = new WeakMap<ts.SourceFile, string>()
  let id = 0
  const getPath = (sf: ts.SourceFile) => relPath.get(sf) ?? path.relative(options.srcDir, sf.fileName)

  return {
    ...options,
    include: (sf: ts.SourceFile) => {
      return options.include(sf)
    },
    compilerOptions: options.cmd.options,
    root: 0,
    parent: 0,
    currentStmt: 0,
    checker,
    nextId: () => ++id,
    getPath,
    references: [],
    exports: [],
    declarations: [],
    symbolsById: new Map(),
    referenceOrigins: new Map(),
    referenceSymbols: new Map(),
    exportsForm: new Map(),
    exportsSpec: new Map(),
    exportsEntries: new Map(),
    exportsAlias: new Map(),
    exportsOrigin: new Map(),
    seen: new Set(),
    langs: new Set(),
  }
}
