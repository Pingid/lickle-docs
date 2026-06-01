import * as cmd from 'cmd-ts'
import path from 'node:path'

import * as config from '../../config/load.ts'
import * as core from '../../core/index.ts'
import * as lib from '../../_lib/index.ts'
import { vite } from '../util/index.ts'

export const dev = cmd.command({
  name: 'dev',
  description: 'Dev server for a project',
  args: {
    docsDir: cmd.option({
      long: 'docs-dir',
      short: 'd',
      type: cmd.optional(cmd.string),
      description: 'Path to the docs directory',
    }),
    port: cmd.option({
      long: 'port',
      short: 'p',
      type: cmd.optional(cmd.number),
      description: 'Port to listen on',
    }),
  },
  handler: (args) => runDev(args),
})

export const build = cmd.command({
  name: 'build',
  description: 'Build the project',
  args: {
    docsDir: cmd.option({
      long: 'docs-dir',
      short: 'd',
      type: cmd.optional(cmd.string),
      description: 'Path to the docs directory',
    }),
  },
  handler: async (args) => console.log('build', args),
})

type Options = {
  docsDir?: string
  port?: number
}

const runDev = async (opts: Options) => {
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
    load: c.custom ? path.join(process.cwd(), c.custom) : undefined,
  })

  lib.util.registerNodeCleanup(async () => await server.close())
}

export const runBuild = async () => {
  const c = await config.load()
  await vite.build({
    srcDir: c.srcDir ?? 'src',
    load: c.custom ? path.join(process.cwd(), c.custom) : undefined,
    json: await core.project.buildJson(await config.toGenerateOptions(c)),
  })
}
