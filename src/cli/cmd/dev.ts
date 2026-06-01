import * as cmd from 'cmd-ts'
import path from 'node:path'

import * as config from '../../config/load.ts'
import * as core from '../../core/index.ts'
import * as lib from '../../_lib/index.ts'
import { vite } from '../util/index.ts'

export const dev = cmd.command({
  name: 'dev',
  description: 'Start a local dev server that rebuilds and live-reloads the docs on change',
  args: {
    docsDir: cmd.option({
      long: 'docs-dir',
      short: 'd',
      type: cmd.optional(cmd.string),
      description: 'Directory containing the docs sources (defaults to the configured srcDir)',
    }),
    port: cmd.option({
      long: 'port',
      short: 'p',
      type: cmd.optional(cmd.number),
      description: 'Port the dev server listens on (defaults to Vite\u2019s next free port)',
    }),
  },
  handler: (args) => runDev(args),
})

export const build = cmd.command({
  name: 'build',
  description: 'Build the static documentation site into the output directory',
  args: {
    docsDir: cmd.option({
      long: 'docs-dir',
      short: 'd',
      type: cmd.optional(cmd.string),
      description: 'Directory containing the docs sources (defaults to the configured srcDir)',
    }),
  },
  handler: (args) => runBuild(args),
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

export const runBuild = async (opts: Options = {}) => {
  const c = await config.load(opts.docsDir ?? process.cwd())
  const json = await core.project.buildJson(await config.toGenerateOptions(c))

  await vite.build({
    srcDir: c.srcDir ?? 'src',
    load: c.custom ? path.join(process.cwd(), c.custom) : undefined,
    json,
  })
}
