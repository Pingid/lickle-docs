import tailwindcss from '@tailwindcss/vite'
import solid from 'vite-plugin-solid'
import * as vite from 'vite'

import path from 'node:path'

import * as config from '../../../config/index.ts'
import * as core from '../../../core/index.ts'
import * as lib from '../../../_lib/index.ts'
import { libRoot } from '../../env.ts'

import * as ssg from './ssg/index.ts'

export interface DocsOptions {
  config: () => Promise<{ json: core.project.ProjectJson; config: config.ConfigJson; file?: string }>
  dir: string
  viteConfig?: vite.InlineConfig
}

export const dev = async (options: DocsOptions) => {
  const server = await vite.createServer(resolveOptions(options, 'dev'))
  await server.listen()
  server.printUrls()
  return server
}

// export const build = async (options: DocsOptions) => vite.build(resolveOptions(options, 'build'))

export const build = async (options: DocsOptions) =>
  ssg.buildStatic({
    json: await options.config().then((c) => c.json),
    clientVite: {
      ...options.viteConfig,
      root: viteRoot,
      plugins: [solid({ solid: { hydratable: true } }), tailwindcss(), docsPlugin(options, 'build')],
    },
    serverVite: {
      ...options.viteConfig,
      root: viteRoot,
      // Bundle every dependency into the SSR entry: Node imports it from a temp dir
      // inside the *consumer* project, which may not have these installed.
      ssr: { noExternal: true },
      // CSS plays no part in the rendered HTML — the client build emits the real
      // stylesheet. Stubbing it (instead of running Tailwind) avoids resolving a
      // consumer's `@import "tailwindcss"`, which they need not have installed.
      plugins: [ignoreCss(), solid({ ssr: true, solid: { hydratable: true } }), docsPlugin(options, 'build')],
    },
  })

/** SSR-only: turn stylesheet imports into empty modules (HTML render needs no CSS). */
const ignoreCss = (): vite.Plugin => ({
  name: 'docs:ignore-css',
  enforce: 'pre',
  load: (id) => (/\.(css|scss|sass|less|styl)(\?|$)/.test(id) ? '' : undefined),
})

const viteRoot = path.resolve(libRoot, 'client')

// Anchor for the fallback resolver: a real file inside lickle-docs whose
// directory has access to lickle-docs' node_modules.
const libImporter = path.resolve(viteRoot, 'entry-client.tsx')

/** A bare specifier (a package import), not relative/absolute/virtual. */
const isBareImport = (id: string): boolean =>
  !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0') && !id.includes(':') && !path.isAbsolute(id)
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

    async resolveId(id, importer, resolveOpts) {
      if (id === PROJECT_JSON_ID) return '\0' + PROJECT_JSON_ID
      if (id === CUSTOM_COMPONENTS_ID) return '\0' + CUSTOM_COMPONENTS_ID

      // A consumer's custom-components file lives outside this project and may
      // not have our dependencies installed. The Solid JSX transform also
      // injects bare `solid-js/web` imports into it. When such a bare import
      // can't be resolved from the consumer, fall back to resolving it from
      // lickle-docs — going back through Vite so export conditions (server vs
      // client) and aliases still apply. This avoids aliasing each package.
      if (!importer || !isBareImport(id)) return undefined
      const normal = await this.resolve(id, importer, { ...resolveOpts, skipSelf: true })
      if (normal) return undefined
      return (await this.resolve(id, libImporter, { ...resolveOpts, skipSelf: true }))?.id
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
