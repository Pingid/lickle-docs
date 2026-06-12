import ts from 'typescript'

import { TsConfig } from '../../_lib/index.ts'

import * as Reflect from '../reflect/index.ts'
import * as Config from '../config/index.ts'
import * as Router from '../route/index.ts'

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
  const scanOptions: Reflect.BuildOptions = {
    dir,
    srcDir: config.srcDir,
    cmd: ts.parseJsonConfigFileContent(tsConfig.config, ts.sys, dir),
    include: (sf) => config.include(sf, true),
    entrypoints: config.entrypoints ?? [],
  }

  const indexed = Reflect.build(scanOptions, abortSignal)

  // const indexed = Reflect.index(s, config.entrypoints ?? [])
  const builder = Router.builder({ docs: indexed, name: config.name, adapter: config.provider })

  for (const page of config.pages ?? []) builder.markdown(page)
  for (const decl of indexed.declarations()) builder.declare(decl)

  const routes = builder.build()

  const json: Config.ProjectVersion = {
    name: config.name,
    version: config.version!,
    repository: config.repository,
    prefix: { doc: config.name.replace(/^@/, ''), page: '' },
    ...routes,
  }

  return { json, config, languages: indexed.languages() }
}
