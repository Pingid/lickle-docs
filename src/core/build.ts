import ts from 'typescript'

import { TsConfig } from '../_lib/index.ts'

import * as Config from './config/index.ts'
import * as Reflect from './reflect/index.ts'
import * as Router from './route/index.ts'

export const buildDocs = async (
  dir: string = process.cwd(),
  config: Config.Config,
  tsConfig: TsConfig.ResolvedTsconfig,
): Promise<Config.ProjectRoutes> => {
  const scanOptions: Reflect.ScanOptions = {
    dir,
    srcDir: config.srcDir,
    cmd: ts.parseJsonConfigFileContent(tsConfig.config, ts.sys, dir),
    include: (sf) => config.include(sf, true),
  }

  const scanned = Reflect.scan(scanOptions)
  const resolved = Reflect.resolve(scanned)
  const indexed = Reflect.index(resolved, config.entrypoints ?? [])

  const builder = Router.builder({ docs: indexed, name: config.name, adapter: config.provider })
  for (const page of config.pages ?? []) builder.markdown(page)
  for (const decl of indexed.declarations()) builder.declare(decl)

  return { ...builder.build(), prefix: { doc: config.name.replace(/^@/, ''), page: '' } }
}
