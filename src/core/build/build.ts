import ts from 'typescript'

import { TsConfig } from '../../_lib/index.ts'

import * as Reflect from '../reflect/index.ts'
import * as Config from '../config/index.ts'
import * as Router from '../route/index.ts'

export type BuildResult = {
  json: Config.ProjectJson
  config: Config.Config
  file: string
  languages: string[]
}

export const build = async (dir: string, abortSignal?: AbortSignal): Promise<BuildResult> => {
  const file = await Config.findFile(dir)
  const load = await Config.load(dir)
  const result = await fromConfig(dir, load.config, load.ts, abortSignal)
  return { ...result, file: file! }
}

export const fromConfig = async (
  dir: string,
  config: Config.Config,
  tsConfig: TsConfig.ResolvedTsconfig,
  abortSignal?: AbortSignal,
): Promise<Omit<BuildResult, 'file'>> => {
  const scanOptions: Reflect.ScanOptions = {
    dir,
    srcDir: config.srcDir,
    cmd: ts.parseJsonConfigFileContent(tsConfig.config, ts.sys, dir),
    include: (sf) => config.include(sf, true),
  }

  const scanned = abortSignal ? await Reflect.scanAsync(scanOptions, abortSignal) : Reflect.scan(scanOptions)
  const resolved = Reflect.resolve(scanned)
  const indexed = Reflect.index(resolved, config.entrypoints ?? [])
  const builder = Router.builder({ docs: indexed, name: config.name, adapter: config.provider })

  for (const page of config.pages ?? []) builder.markdown(page)
  for (const decl of indexed.declarations()) builder.declare(decl)

  const routes = builder.build()

  const json: Config.ProjectJson = {
    name: config.name,
    version: config.version,
    repository: config.repository,
    links: config.links,
    entrypoints: config.entrypoints,
    routes: { ...routes, prefix: { doc: config.name.replace(/^@/, ''), page: '' } },
  }

  return { json, config, languages: Array.from(scanned.langs) }
}
