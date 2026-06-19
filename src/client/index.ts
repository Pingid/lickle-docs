import tailwindcss from '@tailwindcss/vite'
import solid from 'vite-plugin-solid'
import * as vite from 'vite'
import path from 'node:path'

import { Node, Util } from '../_lib/index.ts'

import { clientFiles, libRoot, resolveFile } from './env.ts'
import * as Context from './context/index.ts'
import * as Plugin from './plugins/index.ts'
import * as Ssg from './ssg/index.ts'

export type ClientOptions = Context.ViteContextOptions & {
  dir: string
  port?: number
  outDir: string
  baseUrl: string
  router?: 'hash' | 'browser'
  noJavascript?: boolean
}

export const dev = async (options: ClientOptions) => {
  const context = Context.makeContext(options)
  const server = await vite.createServer(client(options, context))
  await server.listen()
  server.printUrls()
  Node.onExit(() => server.close())
  return server
}

export const preview = async (options: ClientOptions) => {
  const server = await vite.preview({
    base: options.baseUrl,
    build: { outDir: options.outDir },
    server: { port: options.port },
  })
  server.printUrls()
  Node.onExit(() => server.close())
  return server
}

export const build = async (options: ClientOptions) => {
  const context = Context.makeContext(options)
  const c = client(options, context)
  await vite.build(c)
}

export const buildStatic = async (options: ClientOptions) => {
  const context = Context.makeContext(options)
  const clientOptions = ssgClient(options, context)
  const serverOptions = ssgServer(options, context)
  const logger = vite.createLogger()

  await Promise.all([
    vite.build({ ...clientOptions, customLogger: logger }),
    vite.build({ ...serverOptions, customLogger: { ...logger, info: () => {}, warn: () => {} } }),
  ])

  await Ssg.generateStatic({
    logger,
    json: await context.json(),
    outDir: options.outDir,
    baseUrl: options.baseUrl,
    clientEntry: clientOptions.build.rolldownOptions.input,
    serverOutDir: serverOptions.build.outDir,
    serverEntry: serverOptions.build.ssr,
    assetsDir: path.join(options.outDir, clientOptions.build.assetsDir),
    noJavascript: options.noJavascript,
  })
}

const client = (opts: ClientOptions, context: Context.ViteContext) => {
  const config = shared(opts, context)
  config.plugins = [Plugin.html(context), solid(), ...tailwindcss(), ...config.plugins]
  return Util.deepMerge(config, {
    define: { 'import.meta.env.VITE_ROUTER_TYPE': JSON.stringify(opts.router) },
    resolve: { alias: libAlias() },
  } satisfies vite.UserConfig)
}

// vite.mergeConfig()
const ssgClient = (opts: ClientOptions, context: Context.ViteContext) => {
  const config = shared(opts, context)
  config.plugins.push(Plugin.html(context), solid({ solid: { hydratable: !opts.noJavascript } }), ...tailwindcss())
  return Util.deepMerge(config, { build: { manifest: true, rolldownOptions: { input: clientFiles.entry.client } } })
}

const ssgServer = (opts: ClientOptions, context: Context.ViteContext) => {
  const config = shared(opts, context)
  config.plugins.push(solid({ ssr: true, solid: { hydratable: !opts.noJavascript } }), Plugin.ignoreCss())
  return Util.deepMerge(config, {
    build: {
      manifest: true,
      ssr: clientFiles.entry.server,
      rolldownOptions: { output: { format: 'esm' as const } },
      outDir: path.join(opts.outDir, '.server-build'),
    },
    ssr: { noExternal: true },
  } satisfies vite.UserConfig)
}

const shared = (opts: ClientOptions, context: Context.ViteContext) => {
  return {
    root: clientFiles.root,
    base: opts.baseUrl,
    plugins: [Plugin.docs(context), Plugin.components(context), Plugin.shiki(context), Plugin.resolve(context)],
    build: { outDir: opts.outDir, emptyOutDir: true, assetsDir: 'lickle-doc-assets' },
    server: { port: opts.port, fs: { allow: [clientFiles.root] } },
    resolve: { alias: libAlias() },
    // When installed in a consumer, Vite's dep scanner can't crawl the docs
    // app's graph (virtual modules + an entry outside `root`), so it skips
    // pre-bundling and serves deps raw. That breaks CJS/UMD interop — notably
    // sucrase -> @jridgewell/trace-mapping -> resolve-uri (UMD). Force-include
    // the browser deps so they're always optimized to ESM.
    optimizeDeps: { include: BROWSER_DEPS },
    clearScreen: false,
  } satisfies vite.UserConfig
}

// `@solidjs/router` and `solid-js` are intentionally omitted: they ship as raw
// JSX/are handled by `vite-plugin-solid`, and can't be esbuild pre-bundled.
/** Runtime dependencies the docs client loads in the browser. */
const BROWSER_DEPS = [
  '@lickle/cn',
  'sucrase',
  '@orama/orama',
  'marked',
  'shiki',
  'shiki/core',
  'shiki/langs',
  'shiki/engine/oniguruma',
]

const libAlias = () => {
  const LIB_UI_PATH = resolveFile('ui/index.ts')
  const LIB_THEME_CSS_PATH = path.resolve(libRoot, 'theme.css')
  const LIB_SOLIDJS_PATH = resolveFile('solidjs/index.ts')

  return {
    '@lickle/docs/ui': LIB_UI_PATH,
    '@lickle/docs/theme.css': LIB_THEME_CSS_PATH,
    '@lickle/docs/solidjs': LIB_SOLIDJS_PATH,
  }
}
