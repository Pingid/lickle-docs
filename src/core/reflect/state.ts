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

export interface ScanState extends ScanOptions {
  /** Monotonic id source. Every node that needs identity calls this. */
  nextId: () => number
  getPath: (sf: ts.SourceFile) => string
  root: number
  parent: number
  currentStmt: number

  checker: ts.TypeChecker
  references: T.Type<'reference'>[]
  exports: T.Declaration<'export'>[]
  declarations: T.Declaration[]
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
  const relPath = new WeakMap<ts.SourceFile, string>()
  let id = 0
  const getPath = (sf: ts.SourceFile) => relPath.get(sf) ?? path.relative(options.rootDir, sf.fileName)
  return {
    ...options,
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
  }
}
