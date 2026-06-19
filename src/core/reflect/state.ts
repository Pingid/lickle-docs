import ts from 'typescript'
import path from 'path'

import type { Diagnostic } from '../diagnostic/types.ts'
import { t } from '../../_lib/index.ts'
import type * as T from './types.ts'

/** How a given `exports` clause should populate its targets at resolve time. */
export type ExportsForm = 'named-local' | 'named-from' | 'star' | 'namespace-from' | 'assignment'

declare module '../diagnostic/types.ts' {
  interface DiagnosticsMap {
    'scan-start': {}
    'scan-file-start': {}
    'scan-file-end': {}
  }
}

export interface ScanOptions {
  cmd: ts.ParsedCommandLine
  dir: string
  srcDir: string
  include: (sf: ts.SourceFile) => boolean
  emit: (d: Diagnostic) => void
  abortSignal?: AbortSignal
}

export interface ScanState extends ScanOptions {
  checker: ts.TypeChecker
  compilerOptions: ts.CompilerOptions

  /** Source files to scan. */
  files: ts.SourceFile[]

  /** Declarations found in the source files. */
  declarations: Map<T.Id, T.Declaration>

  /** Monotonic id source. Every node that needs identity calls this. */
  nextId: () => T.Id
  getPath: (sf: ts.SourceFile) => string
  root: T.Id
  parent: T.Id
  currentStmt: T.Id
  srcDir: string

  /** References to other declarations. resolved later. */
  references: T.Type<'reference'>[]
  /** Export declarations, which are populated later. */
  exports: Set<T.Declaration<'export'>>

  /** Symbols by id. Used to resolve references. */
  symbolsById: Map<T.Id, ts.Symbol>
  /** Reference origins, used to re-resolve references. */
  referenceOrigins: Map<T.Id, ts.Node>
  /** Symbol for inferred references, which have no syntactic origin to re-resolve. */
  referenceSymbols: Map<T.Id, ts.Symbol>
  /** Node to id mapping. Used to resolve references. */
  idByNode: Map<ts.Node, T.Id>

  // ---- deferred export population ----
  /** exports id -> which population strategy resolve should use. */
  exportsForm: Map<T.Id, ExportsForm>
  /** exports id -> source module specifier text, for the `*-from` forms. */
  exportsSpec: Map<T.Id, string>
  /** exports id -> raw `{ name, as? }` entries, for the `named-*` forms. */
  exportsEntries: Map<T.Id, { name: string; as?: string; type: boolean }[]>
  /** exports id -> alias, for `export * as <alias> from '…'`. */
  exportsAlias: Map<T.Id, string>
  /** exports id -> origin node, so resolve can re-ask the checker. */
  exportsOrigin: Map<T.Id, ts.ExportDeclaration | ts.ExportAssignment>

  /** Source files already scanned — dedups the transitive re-export worklist. */
  seen: Set<ts.SourceFile>

  // Meta info used down stream
  /** Languages found in the source file @example code blocks. */
  langs: Set<string>
}

export const makeScanState = (options: ScanOptions): ScanState => {
  const relPath = new WeakMap<ts.SourceFile, string>()
  let id = 0
  const getPath = (sf: ts.SourceFile) => relPath.get(sf) ?? path.relative(options.srcDir, sf.fileName)

  const program = ts.createProgram(options.cmd.fileNames, options.cmd.options)
  const checker = program.getTypeChecker()

  const files = new Array<ts.SourceFile>()
  for (const file of program.getSourceFiles()) {
    if (!options.include(file)) continue
    const sf = program.getSourceFile(file.fileName)
    if (!sf) continue
    files.push(sf)
  }

  return {
    ...options,
    include: (sf: ts.SourceFile) => {
      return options.include(sf)
    },
    files,
    compilerOptions: options.cmd.options,
    root: t.brand<T.Id>(0),
    parent: t.brand<T.Id>(0),
    currentStmt: t.brand<T.Id>(0),
    checker,
    nextId: () => t.brand<T.Id>(++id),
    getPath,
    references: [],
    exports: new Set(),
    declarations: new Map(),
    symbolsById: new Map(),
    referenceOrigins: new Map(),
    referenceSymbols: new Map(),
    idByNode: new Map(),
    exportsForm: new Map(),
    exportsSpec: new Map(),
    exportsEntries: new Map(),
    exportsAlias: new Map(),
    exportsOrigin: new Map(),
    seen: new Set(),
    langs: new Set(),
  }
}
