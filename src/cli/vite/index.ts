import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import solid from 'vite-plugin-solid'
import * as vite from 'vite'
import path from 'node:path'

import * as config from '../../config/index.ts'
import * as core from '../../core/index.ts'
import * as lib from '../../_lib/index.ts'

const JSON_ID = 'virtual:lickle/docs.json'
const CUSTOM_ID = 'virtual:lickle/custom.ts'
const viteRoot = fileURLToPath(new URL('./client', import.meta.url))
const libRoot = fileURLToPath(new URL('../../../', import.meta.url))

export interface DocsOptions extends config.ConfigJson {
  build: () => Promise<core.project.ProjectJson>
  entrypoint?: string | undefined
  watchPaths?: string[]
  viteConfig?: vite.InlineConfig
}

const resolveOptions = (opts: DocsOptions, mode: 'dev' | 'build') => {
  const outDir = opts.custom ? path.join(path.dirname(opts.custom), 'dist') : 'docs/dist'
  return {
    root: viteRoot,
    plugins: [solid(), tailwindcss(), docsPlugin(opts, mode)],
    build: { outDir: outDir ? path.resolve(process.cwd(), outDir) : path.resolve(process.cwd(), 'docs/dist') },
  }
}

export const dev = async (options: DocsOptions) => {
  const server = await vite.createServer(resolveOptions(options, 'dev'))
  await server.listen()
  server.printUrls()
  return server
}

export const build = async (options: DocsOptions) => vite.build(resolveOptions(options, 'build'))

const docsPlugin = (opts: DocsOptions, mode: 'dev' | 'build'): vite.Plugin => {
  let json: string | undefined
  let logger: vite.Logger | undefined = undefined

  const HMR_PATH = `/@virtual:${JSON_ID}`
  const LIB_UI_PATH = path.resolve(libRoot, './src/ui/index.ts')
  const LIB_THEME_CSS_PATH = path.resolve(libRoot, 'theme.css')
  const LIB_SOLIDJS_PATH = path.resolve(libRoot, './src/solidjs/index.ts')

  return {
    name: 'docs',
    enforce: 'pre',
    configResolved(config) {
      logger = config.logger
    },
    config: () => {
      return {
        resolve: {
          alias: {
            '@lickle/docs/ui': LIB_UI_PATH,
            '@lickle/docs/theme.css': LIB_THEME_CSS_PATH,
            '@lickle/docs/solidjs': LIB_SOLIDJS_PATH,
          },
        },
        server: { fs: { allow: [viteRoot, opts.entrypoint ? path.dirname(opts.entrypoint) : viteRoot] } },
      }
    },

    // transformIndexHtml: {
    //   order: 'pre',
    //   handler(html) {
    //     return html.replace('<script type="module" src="./index.tsx"></script>', `<script type="module" src="${entrypoint}"></script>`)
    //   },
    // },

    resolveId(id) {
      if (id === JSON_ID || id === HMR_PATH) return '\0' + JSON_ID
      if (id === CUSTOM_ID) return '\0' + CUSTOM_ID
      return undefined
    },

    async load(id) {
      if (id === '\0' + JSON_ID) {
        if (mode === 'build') return JSON.stringify(await opts.build())
        return json ?? 'null'
      }
      if (id === '\0' + CUSTOM_ID) return opts.entrypoint ? `import ${JSON.stringify(opts.entrypoint)}\n` : '\n'
      return undefined
    },

    configureServer(s) {
      if (!opts.build) return
      const build = opts.build
      const handleJson = async () => {
        if (json) logger?.info('Rebuilding docs', { timestamp: true })
        const nextJson = await build()
        json = JSON.stringify(nextJson)
        logger?.info('Docs built successfully', { timestamp: true })

        const mod = s.moduleGraph.getModuleById('\0' + JSON_ID)
        if (mod) {
          s.moduleGraph.invalidateModule(mod)
          s.ws.send({ type: 'custom', event: 'docs-update', data: nextJson })
        }
      }

      const watchPaths = opts.watchPaths ?? []
      watchPaths.forEach((p) => s.watcher.add(p))

      const rebuild = lib.util.serial(() => handleJson())
      s.watcher.on('change', (changedPath) => watchPaths.some((p) => changedPath.includes(p)) && rebuild())
      rebuild()
    },
  }
}
