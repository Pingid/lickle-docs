import ts from 'typescript6'
import path from 'path'

import type { Diagnostic } from '../diagnostic/types.ts'
import * as t from '../../_lib/t.ts'
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
  /**
   * The TypeScript program to reflect over. Pass a `ParsedCommandLine` and one
   * is created; pass a `ts.Program` (or a factory) to reuse an existing one —
   * the dev server does this so a rebuild does not re-typecheck the world.
   */
  cmd: ts.ParsedCommandLine
  /** A prebuilt program, reused as-is. Takes precedence over `cmd`. */
  program?: ts.Program | (() => ts.Program)
  /** Project root. Every path the reflection reports is relative to this. */
  dir: string
  srcDir: string
  include: (sf: ts.SourceFile) => boolean
  /**
   * Which files to walk.
   *
   * - `'all'` (default) — every file in the program that `include` accepts.
   * - `'reachable'` — start at the entrypoints and follow imports/re-exports,
   *   so files nothing exports are never read. Cheaper on large repos, and it
   *   makes `exclude` largely unnecessary.
   */
  scan?: 'all' | 'reachable'
  /** Entrypoint files, used as the roots of a `'reachable'` scan. */
  entryFiles?: string[]
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
  // Project-relative and POSIX-separated. One path base for the whole system:
  // what a source line shows, what `Match.file` globs, what `include` receives,
  // and what a repository `fileUrl` appends — all the same string.
  const getPath = (sf: ts.SourceFile) =>
    relPath.get(sf) ?? path.relative(options.dir, sf.fileName).split(path.sep).join('/')

  const program =
    typeof options.program === 'function'
      ? options.program()
      : (options.program ?? ts.createProgram(options.cmd.fileNames, options.cmd.options))
  const checker = program.getTypeChecker()

  const candidates =
    options.scan === 'reachable' ? reachableFiles(program, options.entryFiles ?? []) : program.getSourceFiles()

  const files = new Array<ts.SourceFile>()
  for (const file of candidates) {
    if (!options.include(file)) continue
    const sf = program.getSourceFile(file.fileName)
    if (!sf) continue
    files.push(sf)
  }

  return {
    ...options,
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

/**
 * Source files reachable from `entries` by following import and export
 * specifiers. Declaration files and anything outside the program are skipped;
 * an unresolvable specifier simply ends that branch rather than failing the
 * scan. With no entries this returns nothing, so callers must pass roots.
 */
const reachableFiles = (program: ts.Program, entries: string[]): ts.SourceFile[] => {
  const out: ts.SourceFile[] = []
  const seen = new Set<string>()
  const queue: ts.SourceFile[] = []

  for (const entry of entries) {
    const sf = program.getSourceFile(entry)
    if (sf && !seen.has(sf.fileName)) {
      seen.add(sf.fileName)
      queue.push(sf)
    }
  }

  const checker = program.getTypeChecker()
  while (queue.length) {
    const sf = queue.shift()!
    out.push(sf)
    for (const spec of moduleSpecifiers(sf)) {
      const symbol = checker.getSymbolAtLocation(spec)
      for (const decl of symbol?.declarations ?? []) {
        const target = decl.getSourceFile()
        if (target.isDeclarationFile || seen.has(target.fileName)) continue
        seen.add(target.fileName)
        queue.push(target)
      }
    }
  }
  return out
}

/** Every `from '…'` string literal in a file's imports and re-exports. */
const moduleSpecifiers = function* (sf: ts.SourceFile): Generator<ts.StringLiteral> {
  for (const stmt of sf.statements) {
    const spec =
      ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt) ? (stmt.moduleSpecifier ?? undefined) : undefined
    if (spec && ts.isStringLiteral(spec)) yield spec
  }
}
