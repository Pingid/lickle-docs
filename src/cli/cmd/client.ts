import * as cmd from 'cmd-ts'
import path from 'node:path'

import { Config } from '../../core/index.ts'
import * as Client from '../../client/index.ts'
import * as Core from '../../core/index.ts'

/** Flags and options shared across the `dev`, `build`, and `preview` commands. */
const Options = {
  base: cmd.option({
    long: 'base',
    short: 'b',
    type: cmd.optional(cmd.string),
    description: 'Public base path the site is served under, e.g. /my-lib/ (default: /)',
  }),
  port: cmd.option({
    long: 'port',
    short: 'p',
    type: cmd.optional(cmd.number),
    description: 'Port for the dev or preview server (default: first free port)',
  }),
  static: cmd.flag({
    long: 'static',
    short: 's',
    description: 'Pre-render every route to static HTML instead of a client-only SPA',
  }),
  outDir: cmd.option({
    long: 'outDir',
    short: 'o',
    type: cmd.string,
    defaultValue: () => 'docs/dist' as const,
    defaultValueIsSerializable: true,
    description: 'Directory to write the built site into',
  }),
  router: cmd.option({
    long: 'router',
    short: 'r',
    type: cmd.oneOf(['hash', 'browser']),
    defaultValue: () => 'browser' as const,
    defaultValueIsSerializable: true,
    description: 'Client routing mode: browser (clean URLs) or hash',
  }),
  noScript: cmd.flag({
    long: 'no-script',
    description: 'Emit plain HTML with no client JavaScript (applies to --static builds only)',
  }),
  manifest: cmd.option({
    long: 'manifest',
    description: 'Include manifest containing versioned routes',
    type: cmd.optional(cmd.string),
  }),
}

export const dev = cmd.command({
  name: 'dev',
  description: 'Start a local dev server that rebuilds and live-reloads the docs on change',
  args: { base: Options.base, port: Options.port, router: Options.router },
  handler: (args) => Client.dev(resolveOptions(args)),
})

export const build = cmd.command({
  name: 'build',
  description: 'Build the documentation site into the output directory',
  args: {
    base: Options.base,
    port: Options.port,
    static: Options.static,
    outDir: Options.outDir,
    router: Options.router,
    noScript: Options.noScript,
    manifest: Options.manifest,
  },
  handler: async (args) => {
    if (args.static) await Client.buildStatic(resolveOptions(args))
    else await Client.build(resolveOptions(args))
  },
})

export const preview = cmd.command({
  name: 'preview',
  description: 'Serve a previously built site locally',
  args: { base: Options.base, port: Options.port },
  handler: (args) => Client.preview(resolveOptions(args)),
})

/** Map parsed CLI args to the options shape the client builders expect. */
const resolveOptions = (args: {
  base?: string
  port?: number
  static?: boolean
  outDir?: string
  router?: 'hash' | 'browser'
  noScript?: boolean
  manifest?: string
}): Client.ClientOptions => {
  const dir = process.cwd()

  return {
    dir,
    config: configLoader(dir),
    router: args.router,
    baseUrl: args.base ?? '/',
    outDir: path.resolve(dir, args.outDir ?? 'docs/dist'),
    noJavascript: args.noScript,
    manifest: args.manifest ? path.resolve(dir, args.manifest) : undefined,
  }
}

/** Lazily load config + reflection JSON for the project rooted at `dir`. */
const configLoader =
  (dir: string, manifest?: string): Client.ClientOptions['config'] =>
  async () => {
    const file = await Core.Config.findFile(dir)
    const load = await Core.Config.load(dir)
    const project = await Core.buildDocs(dir, load.config)
    const json: Config.ProjectJson = {
      name: load.config.name,
      version: load.config.version,
      repository: load.config.repository,
      links: load.config.links,
      entrypoints: load.config.entrypoints,
      routes: project.routes,
      slugBase: project.slugBase,
      declarations: project.declarations,
      manifest,
    }
    return { json, config: load.config, file }
  }
