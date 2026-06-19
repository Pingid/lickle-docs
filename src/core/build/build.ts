import ts from 'typescript'

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
}

export const build = async (dir: string, abortSignal?: AbortSignal): Promise<BuildResult> => {
  const file = await Config.findFile(dir)
  const load = await Config.load(dir)
  const result = fromConfig(dir, load.config, load.ts, abortSignal)

  return { ...result, file: file! }
}

export const fromConfig = (
  dir: string,
  config: Config.Config,
  tsConfig: TsConfig.ResolvedTsconfig,
  abortSignal?: AbortSignal,
): Omit<BuildResult, 'file'> => {
  const emit = (d: Diagnostic) => {
    if (d.level === 'error') console.error(`[layout:${d.code}] ${d.message}`)
    else if (d.level === 'warn') console.warn(`[layout:${d.code}] ${d.message}`)
    // else if (d.level === 'info') console.info(`[layout:${d.code}] ${d.message}`)
  }
  const scanOptions: Reflect.BuildOptions = {
    dir,
    srcDir: config.srcDir,
    cmd: ts.parseJsonConfigFileContent(tsConfig.config, ts.sys, dir),
    include: (sf) => config.include(sf, true),
    entrypoints: config.entrypoints ?? [],
    emit,
    abortSignal,
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

  return { json, config, languages: indexed.languages() }
}

/** Build the site graph: placement-based pages plus the server-built sidebar tree. */
const buildLayout = (docs: Reflect.Index, config: Config.Config, emit: (d: Diagnostic) => void) => {
  const builder = Layout.builder({
    docs,
    name: config.name,
    filter: config.filter,
    layout: config.layout,
    transform: config.transform,
    emit: emit,
  })
  for (const page of config.pages ?? []) builder.markdown(page)
  for (const decl of docs.declarations()) builder.declare(decl)
  return builder.build()
}
