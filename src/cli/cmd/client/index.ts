import * as cmd from 'cmd-ts'
import path from 'node:path'

import * as config from '../../../config/load.ts'
import * as core from '../../../core/index.ts'
import * as lib from '../../../_lib/index.ts'

// import * as ssg from './ssg/index.ts'
import * as vite from './vite.ts'

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
    base: cmd.option({
      long: 'basePath',
      short: 'b',
      type: cmd.optional(cmd.string),
      description: 'Base URL the documentation site is served under (e.g. /my-lib/)',
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
    base: cmd.option({
      long: 'basePath',
      short: 'b',
      type: cmd.optional(cmd.string),
      description: 'Base URL for the documentation site',
    }),
  },
  handler: (args) => runBuild(args),
})

type Options = {
  docsDir?: string
  port?: number
  base?: string
}

const runDev = async (opts: Options) => {
  const dir = opts.docsDir ?? process.cwd()
  const server = await vite.dev({
    dir,
    config: configLoader(dir),
    viteConfig: { base: opts.base, server: { port: opts.port } },
  })
  lib.util.registerNodeCleanup(async () => await server.close())
}

export const runBuild = async (opts: Options = {}) => {
  const dir = opts.docsDir ?? process.cwd()
  const c = await config.load(dir)
  await vite.build({
    ...c,
    dir,
    config: configLoader(dir),
    viteConfig: {
      base: opts.base,
      build: { outDir: opts.docsDir ? path.resolve(path.dirname(opts.docsDir), 'dist') : path.resolve('docs/dist') },
    },
  })
}

const configLoader = (dir: string) => async () => {
  const c = await config.load(dir)
  const file = await config.findFile(dir)
  const json = await core.project.buildJson(await config.toGenerateOptions(c))
  return { json, config: c, file }
}
