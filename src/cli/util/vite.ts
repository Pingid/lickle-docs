import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import solid from 'vite-plugin-solid'
import * as vite from 'vite'
import path from 'node:path'

import * as lib from '../../_lib/index.ts'

const JSON_ID = 'virtual:lickle/docs.json'
const CUSTOM_ID = 'virtual:lickle/custom.ts'
const viteRoot = fileURLToPath(new URL('./client', import.meta.url))
const libRoot = fileURLToPath(new URL('../../../', import.meta.url))

type Options = {
  srcDir: string
  port?: number
  watchPaths: string[]
  load?: string | undefined
  build: () => Promise<any>
}

export const dev = async (opts: Options) => {
  const server = await vite.createServer({
    root: viteRoot,
    plugins: [solid(), tailwindcss(), docsPlugin(opts)],
    clearScreen: false,
  })
  await server.listen()
  server.printUrls()

  return server
}

const docsPlugin = (opts: Options): vite.Plugin => {
  let json: any | undefined
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
    config: () => ({
      resolve: {
        alias: {
          '@lickle/docs/ui': LIB_UI_PATH,
          '@lickle/docs/theme.css': LIB_THEME_CSS_PATH,
          '@lickle/docs/solidjs': LIB_SOLIDJS_PATH,
        },
      },
      server: { fs: { allow: [viteRoot, ...(opts.load ? [opts.load] : [])] } },
    }),

    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // const loaded = opts.load;
        const loaded = null
        const script = loaded
          ? `<script type="module" src="${loaded}"></script>`
          : '<script type="module" src="./dev.tsx"></script>'
        return html.replace('<script type="module" src="./index.tsx"></script>', script)
      },
    },

    resolveId(id) {
      if (id === JSON_ID || id === HMR_PATH) return '\0' + JSON_ID
      if (id === CUSTOM_ID) return '\0' + CUSTOM_ID
      return undefined
    },

    load(id) {
      if (id === '\0' + JSON_ID) return json ?? 'null'
      if (id === '\0' + CUSTOM_ID) return opts.load ? `import ${JSON.stringify(opts.load)}\n` : '\n'
      return undefined
    },

    configureServer(s) {
      const handleJson = async () => {
        if (json) logger?.info('Rebuilding docs', { timestamp: true })
        const nextJson = await opts.build()
        json = JSON.stringify(nextJson)
        logger?.info('Docs built successfully', { timestamp: true })

        const mod = s.moduleGraph.getModuleById('\0' + JSON_ID)
        if (mod) {
          s.moduleGraph.invalidateModule(mod)
          s.ws.send({ type: 'custom', event: 'docs-update', data: nextJson })
        }
      }

      opts.watchPaths.forEach((p) => s.watcher.add(p))

      const rebuild = lib.util.serial(() => handleJson())
      s.watcher.on('change', (changedPath) => opts.watchPaths.some((p) => changedPath.includes(p)) && rebuild())
      rebuild()
    },
  }
}
