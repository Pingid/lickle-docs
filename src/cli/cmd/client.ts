import * as cmd from 'cmd-ts'
import path from 'node:path'

import * as Client from '../../client/index.ts'
import * as Config from '../../config/load.ts'
import * as Core from '../../core/index.ts'

const Options = {
  base: cmd.option({
    long: 'basePath',
    short: 'b',
    type: cmd.optional(cmd.string),
    description: 'Base URL the documentation site is served under (e.g. /my-lib/)',
  }),
  port: cmd.option({
    long: 'port',
    short: 'p',
    type: cmd.optional(cmd.number),
    description: 'Port the dev server listens on (defaults to Vite\u2019s next free port)',
  }),
  ssg: cmd.flag({ long: 'ssg', short: 's', description: 'Build the static site generator (defaults to false)' }),
  outDir: cmd.option({
    long: 'outDir',
    short: 'o',
    type: cmd.optional(cmd.string),
    description: 'Directory to output the built site to (defaults to ./docs/dist)',
  }),
}

export const dev = cmd.command({
  name: 'dev',
  description: 'Start a local dev server that rebuilds and live-reloads the docs on change',
  args: { base: Options.base, port: Options.port },
  handler: (args) => Client.dev(resolveOptions(args)),
})

export const build = cmd.command({
  name: 'build',
  description: 'Build the static documentation site into the output directory',
  args: { base: Options.base, port: Options.port, ssg: Options.ssg, outDir: Options.outDir },
  handler: async (args) => {
    if (args.ssg) await Client.buildStatic(resolveOptions(args))
    else await Client.build(resolveOptions(args))
  },
})

export const preview = cmd.command({
  name: 'preview',
  description: 'Start a preview server',
  args: { base: Options.base, port: Options.port },
  handler: (args) => Client.preview(resolveOptions(args)),
})

const resolveOptions = (args: { base?: string; port?: number; ssg?: boolean; outDir?: string }) => {
  const dir = process.cwd()
  return {
    dir,
    config: configLoader(dir),
    baseUrl: args.base ?? '/',
    outDir: path.resolve(dir, args.outDir ?? 'docs/dist'),
  }
}

const configLoader = (dir: string) => async () => {
  const c = await Config.load(dir)
  const file = await Config.findFile(dir)
  const json = await Core.project.buildJson(await Config.toGenerateOptions(c))
  return { json, config: c, file }
}
