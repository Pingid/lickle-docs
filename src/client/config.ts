import tailwindcss from '@tailwindcss/vite'
import solid from 'vite-plugin-solid'
import * as vite from 'vite'
import path from 'node:path'

import * as Lib from '../_lib/index.ts'

import { clientFiles, libRoot } from './env.ts'
import * as Context from './contex.ts'
import * as Plugin from './plugins.ts'

export type ClientOptions = Context.ViteContextOptions & {
  dir: string
  port?: number
  outDir: string
  baseUrl: string
}

export const dev = async (options: ClientOptions) => {
  const server = await vite.createServer(client(options))
  await server.listen()
  server.printUrls()
  return server
}

export const build = async (options: ClientOptions) => vite.build(client(options))

export const buildStatic = async (options: ClientOptions) => {
  await Promise.all([vite.build(ssgClient(options)), vite.build(ssgServer(options))])
}

export const client = (opts: ClientOptions) => {
  const context = Context.makeContext(opts)
  const config = shared(opts, context)
  config.plugins!.push(solid(), ...tailwindcss())
  config.resolve.alias = devAlias()
  return config
}

// vite.mergeConfig()
export const ssgClient = (opts: ClientOptions) => {
  const context = Context.makeContext(opts)
  const config = shared(opts, context)
  config.plugins.push(solid({ solid: { hydratable: true } }), ...tailwindcss())
  return Lib.util.deepMerge(config, {
    clearScreen: false,
    build: {
      manifest: true,
      rolldownOptions: { input: clientFiles.entry.client },
    },
  })
}

export const ssgServer = (opts: ClientOptions) => {
  const context = Context.makeContext(opts)
  const config = shared(opts, context)
  config.plugins.push(solid({ ssr: true, solid: { hydratable: true } }), Plugin.ignoreCss())
  return Lib.util.deepMerge(config, {
    clearScreen: false,
    ssr: { external: true },
    build: {
      ssr: clientFiles.entry.server,
      rolldownOptions: { output: { format: 'esm' as const } },
      outDir: path.join(opts.outDir, '.temp/server'),
    },
  } satisfies vite.UserConfig)
}

const shared = (opts: ClientOptions, context: Context.ViteContext) =>
  ({
    root: clientFiles.root,
    base: opts.baseUrl,
    plugins: [Plugin.project(context), Plugin.components(context)],
    build: { outDir: opts.outDir },
    server: { port: opts.port, fs: { allow: [clientFiles.root] } },
    resolve: { alias: {} },
  }) satisfies vite.UserConfig

const devAlias = () => {
  const LIB_UI_PATH = path.resolve(libRoot, './src/ui/index.ts')
  const LIB_THEME_CSS_PATH = path.resolve(libRoot, 'theme.css')
  const LIB_SOLIDJS_PATH = path.resolve(libRoot, './src/solidjs/index.ts')

  return {
    '@lickle/docs/ui': LIB_UI_PATH,
    '@lickle/docs/theme.css': LIB_THEME_CSS_PATH,
    '@lickle/docs/solidjs': LIB_SOLIDJS_PATH,
  }
}
