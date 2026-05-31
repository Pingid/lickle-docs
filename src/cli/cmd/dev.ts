import * as config from '../../config/load.ts'
import * as core from '../../core/index.ts'
import * as lib from '../../_lib/index.ts'
import { vite } from '../util/index.ts'

type Options = {
  docsDir?: string
  port?: number
}

export const run = async (opts: Options) => {
  let watchList: string[] = []
  const configFile = await config.findFile(process.cwd())
  if (configFile) watchList.push(configFile)

  const c = await config.load()
  if (c.srcDir) watchList.push(c.srcDir)

  const server = await vite.dev({
    build: async () => core.project.buildJson(await config.loadGen(process.cwd())),
    srcDir: c.srcDir ?? 'src',
    port: opts.port,
    watchPaths: [...watchList],
  })

  lib.util.registerNodeCleanup(async () => await server.close())
}
