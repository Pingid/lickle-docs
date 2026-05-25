import tailwindcss from '@tailwindcss/vite'
import solid from 'vite-plugin-solid'
import * as vite from 'vite'
import path from 'node:path'

import * as config from '../../../config/index.ts'
import * as core from '../../../core/index.ts'
import * as lib from '../../../_lib/index.ts'
import { libRoot } from '../../env.ts'

export interface DocsOptions {
  config: () => Promise<{ json: core.project.ProjectJson; config: config.ConfigJson; file: string }>
  dir: string
  viteConfig?: vite.InlineConfig
}

export const dev = async (options: DocsOptions) => {
  const server = await vite.createServer(resolveOptions(options, 'dev'))
  await server.listen()
  server.printUrls()
  return server
}

export const build = async (options: DocsOptions) => vite.build(resolveOptions(options, 'build'))

const viteRoot = path.resolve(libRoot, 'client')
const resolveOptions = (opts: DocsOptions, mode: 'dev' | 'build') => ({
  ...opts.viteConfig,
  root: viteRoot,
  plugins: [solid(), tailwindcss(), docsPlugin(opts, mode)],
})

const docsPlugin = (opts: DocsOptions, _mode: 'dev' | 'build'): vite.Plugin => {
  const PROJECT_JSON_ID = 'virtual:lickle/docs.json'
  const CUSTOM_COMPONENTS_ID = 'virtual:lickle/custom-components'
  let logger: vite.Logger | undefined = undefined

  let options = opts.config()

  return {
    name: 'docs',
    enforce: 'pre',
    configResolved(config) {
      logger = config.logger
    },
    config: () => {
      return {
        resolve: { alias: devAlias() },
        server: { fs: { allow: [viteRoot, ...(opts.dir ? [path.resolve(opts.dir)] : [])] } },
      }
    },

    resolveId(id) {
      if (id === PROJECT_JSON_ID) return '\0' + PROJECT_JSON_ID
      if (id === CUSTOM_COMPONENTS_ID) return '\0' + CUSTOM_COMPONENTS_ID
      return undefined
    },

    async load(id) {
      if (id === '\0' + PROJECT_JSON_ID) {
        const j = await options.then((c) => c.json)
        return JSON.stringify(j)
      }
      if (id === '\0' + CUSTOM_COMPONENTS_ID) {
        const c = await options
        if (!c.config.components) return `export const components = {};\n`
        return `export { default as components } from ${JSON.stringify(path.resolve(opts.dir, c.config.components))}\n`
      }
      return undefined
    },

    configureServer(s) {
      if (!opts.config) return
      const watcher = fileWatcher(s, opts.dir)

      const handleJson = async () => {
        options = opts.config()
        const c = await options

        watcher.watch(path.resolve(libRoot, './src'), opts.dir, c.file, c.config.components)

        const mod = s.moduleGraph.getModuleById('\0' + PROJECT_JSON_ID)
        if (mod) {
          s.moduleGraph.invalidateModule(mod)
          s.ws.send({ type: 'custom', event: 'docs-update', data: c.json })
        }

        logger?.info('Docs built successfully', { timestamp: true })
      }

      const rebuild = lib.util.serial(() => handleJson())
      s.watcher.on('change', (changedPath) => watcher.has(changedPath) && rebuild())
      rebuild()
    },
  }
}

const fileWatcher = (s: vite.ViteDevServer, dir: string) => {
  let previous = new Set<string>()
  return {
    watch: (...pths: (string | undefined)[]) => {
      const next = new Set(pths.filter((p): p is string => !!p).map((p) => path.resolve(dir, p)))
      for (const p in previous) {
        if (!next.has(p)) s.watcher.unwatch(p)
      }
      for (const n in next) {
        if (!previous.has(n)) s.watcher.add(n)
      }
      previous = new Set(next)
    },
    has: (p: string) => previous.has(p),
  }
}

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
