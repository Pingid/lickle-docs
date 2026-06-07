import ts from 'typescript'
import path from 'node:path'

import { TsConfig } from '../_lib/index.ts'

import * as Config from './config/index.ts'
import * as Reflect from './reflect/index.ts'
import * as Router from './route/index.ts'

export const buildDocs = async (
  dir: string = process.cwd(),
  config: Config.Config,
): Promise<{ index: Reflect.Index; routes: Router.Route[]; slugBase: string; declarations: Reflect.Declaration[] }> => {
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

  const docroutes = Router.docRoutes({ docs: indexed, adapter: config.provider })

  const declarations = Router.compact({ docs: indexed, routes: docroutes.routes })

  return {
    routes: [...config.routes, ...docroutes.routes],
    slugBase: docroutes.slugBase,
    declarations,
    index: indexed,
  }
}
