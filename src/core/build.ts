import ts from 'typescript'
import path from 'node:path'

import { TsConfig } from '../_lib/index.ts'

import * as Config from './config/index.ts'
import * as Reflect from './reflect/index.ts'
import * as Router from './route/index.ts'

export const buildDocs = async (
  dir: string = process.cwd(),
  config: Config.Config,
): Promise<{ index: Reflect.Index } & Router.DocRoutes> => {
  const c = TsConfig.resolve(dir, config.tsconfig)
  if (!c.config) throw new Error('No tsconfig.json found')

  const scanOptions: Reflect.ScanOptions = {
    dir,
    srcDir: config.srcDir,
    cmd: ts.parseJsonConfigFileContent(c.config, ts.sys, path.dirname(c.config.path)),
    include: config.include,
  }

  const scanned = Reflect.scan(scanOptions)
  const resolved = Reflect.resolve(scanned)
  const indexed = Reflect.index(resolved, config.entrypoints ?? [])

  const builder = Router.builder({ docs: indexed, adapter: config.provider })
  for (const page of config.pages ?? []) builder.markdown(page)
  for (const decl of indexed.declarations()) builder.declare(decl)

  return { ...builder.build(), index: indexed }
}
