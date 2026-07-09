import ts from 'typescript6'

import { TsConfig } from '../../_lib/index.ts'

import type { Diagnostic } from '../diagnostic/index.ts'
import * as Reflect from '../reflect/index.ts'
import * as Layout from '../layout/index.ts'
import * as Config from '../config/index.ts'

export type BuildResult = {
  json: Config.ProjectVersion
  config: Config.ConfigJson
  file: string
  languages: string[]
  /** Everything the scan and the layout reported, in the order it was reported. */
  diagnostics: Diagnostic[]
}

export type BuildOptions = {
  abortSignal?: AbortSignal
  /** Reuse an existing program instead of creating one — the dev server's rebuild path. */
  program?: ts.Program | (() => ts.Program)
}

export const build = async (dir: string, opts?: BuildOptions | AbortSignal): Promise<BuildResult> => {
  const options = normalize(opts)
  const collected: Diagnostic[] = []
  const file = await Config.findFile(dir)
  const load = await Config.load(dir, undefined, (d) => collected.push(d))
  const result = fromConfig(dir, load.config, load.ts, options)

  return { ...result, file: file!, diagnostics: [...collected, ...result.diagnostics] }
}

const normalize = (opts?: BuildOptions | AbortSignal): BuildOptions =>
  opts === undefined ? {} : opts instanceof AbortSignal ? { abortSignal: opts } : opts

export const fromConfig = (
  dir: string,
  config: Config.Config,
  tsConfig: TsConfig.ResolvedTsconfig,
  opts?: BuildOptions | AbortSignal,
): Omit<BuildResult, 'file'> => {
  const options = normalize(opts)
  const diagnostics: Diagnostic[] = []
  // Collected for the caller (so `--strict` can fail on a warning, and the dev
  // server can surface them) *and* echoed to the console as they happen.
  const emit = (d: Diagnostic) => {
    diagnostics.push(d)
    if (d.level === 'error') console.error(`[layout:${d.code}] ${d.message}`)
    else if (d.level === 'warn') console.warn(`[layout:${d.code}] ${d.message}`)
  }

  const scanOptions: Reflect.BuildOptions = {
    dir,
    srcDir: config.srcDir,
    cmd: ts.parseJsonConfigFileContent(tsConfig.config, ts.sys, dir),
    program: options.program,
    include: config.includeFile,
    scan: config.scan,
    entryFiles: (config.entrypoints ?? []).map((e) => e.path),
    entrypoints: config.entrypoints ?? [],
    emit,
    abortSignal: options.abortSignal,
  }

  const indexed = Reflect.build(scanOptions)

  const generated = buildLayout(indexed, config, emit)

  const json: Config.ProjectVersion = {
    name: config.name,
    version: config.version!,
    repository: config.repository,
    prefix: { doc: config.name.replace(/^@/, ''), page: '' },
    ...generated,
  }

  return { json, config, languages: indexed.languages(), diagnostics }
}

/**
 * The layout builder, primed with every source the site will contain. Shared by
 * the build and by `ldocs why`, so an explanation always runs through the
 * identical layout the build used.
 */
export const makeBuilder = (docs: Reflect.Index, config: Config.Config, emit: (d: Diagnostic) => void) => {
  const builder = Layout.builder({
    docs,
    name: config.name,
    layout: config.layout,
    refine: config.refine,
    transform: config.transform,
    emit,
  })
  for (const page of config.pageSources ?? []) builder.page(page)
  for (const decl of docs.declarations()) builder.declare(decl)
  return builder
}

/** Build the site graph: placement-based pages plus the server-built sidebar tree. */
const buildLayout = (docs: Reflect.Index, config: Config.Config, emit: (d: Diagnostic) => void) =>
  makeBuilder(docs, config, emit).build()

/** Reflect over a project without laying anything out — what `ldocs why` needs first. */
export const reflect = (
  dir: string,
  config: Config.Config,
  tsConfig: TsConfig.ResolvedTsconfig,
  emit: (d: Diagnostic) => void,
): Reflect.Index =>
  Reflect.build({
    dir,
    srcDir: config.srcDir,
    cmd: ts.parseJsonConfigFileContent(tsConfig.config, ts.sys, dir),
    include: config.includeFile,
    scan: config.scan,
    entryFiles: (config.entrypoints ?? []).map((e) => e.path),
    entrypoints: config.entrypoints ?? [],
    emit,
  })
