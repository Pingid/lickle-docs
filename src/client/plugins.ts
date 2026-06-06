import * as vite from 'vite'

import path from 'node:path'

import { Util } from '../_lib/index.ts'

import { htmlShellGenerator, type ViteContext } from './contex.ts'
import { clientFiles, libRoot } from './env.ts'

export const project = (config: ViteContext): vite.Plugin => {
  const PROJECT_JSON_ID = 'virtual:lickle/docs.json'
  let logger: vite.Logger | undefined = undefined

  return {
    name: '@lickle/docs:plugin-project',
    enforce: 'pre',
    configResolved(config) {
      logger = config.logger
    },
    async resolveId(id) {
      if (id === PROJECT_JSON_ID) return '\0' + PROJECT_JSON_ID
      return undefined
    },

    async load(id) {
      if (id !== '\0' + PROJECT_JSON_ID) return undefined
      return JSON.stringify(await config.json())
    },

    configureServer(s) {
      s.watcher.add([config.dir])

      let last = '0'
      const handleJson = async () => {
        await config.rebuild()
        const json = await config.json()
        const hash = JSON.stringify(json)
        if (hash === last) return
        last = hash
        s.ws.send({ type: 'custom', event: 'docs-update', data: json })
        logger?.info('Docs built successfully', { timestamp: true })
      }

      const isProjectFile = (path: string) => {
        if (!path.startsWith(config.dir)) return false
        if (/(\.ts|\.tsx|\.md)$/.test(path)) return true
        if (/package.json$/.test(path)) return true
        return false
      }

      const rebuild = Util.serial(() => handleJson())
      s.watcher.on('change', (changedPath) => isProjectFile(changedPath) && rebuild())
      rebuild()
    },
  }
}

export const components = (opts: ViteContext): vite.Plugin => {
  const CUSTOM_COMPONENTS_ID = 'virtual:lickle/custom-components'
  return {
    name: '@lickle/docs:plugin-components',
    async resolveId(id) {
      if (id === CUSTOM_COMPONENTS_ID) return '\0' + CUSTOM_COMPONENTS_ID
      return undefined
    },
    async load(id) {
      if (id === '\0' + CUSTOM_COMPONENTS_ID) {
        const c = await opts.config().then((c) => c.components)
        if (!c) return `export const components = {};\n`
        return `export { default as components } from ${JSON.stringify(path.resolve(opts.dir, c))}\n`
      }
      return undefined
    },
  }
}

/** SSR-only: turn stylesheet imports into empty modules (HTML render needs no CSS). */
export const ignoreCss = (): vite.Plugin => ({
  name: '@lickle/docs:plugin-ignore-css',
  enforce: 'pre',
  load: (id) => (/\.(css|scss|sass|less|styl)(\?|$)/.test(id) ? '' : undefined),
})

export const html = (opts: ViteContext): vite.Plugin => {
  const RESOLVED_HTML_ID = path.join(clientFiles.root, 'index.html')

  const htmlShell = htmlShellGenerator()
  const load = async () => {
    const json = await opts.json()
    const html = (await htmlShell)({
      body: '<div id="root"></div>',
      head: '<script type="module" src="/entry.tsx"></script>',
      title: json.name,
    })
    return html
  }

  return {
    name: '@lickle/docs:plugin-html',
    enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('index.html') || id.endsWith('/index.html')) return RESOLVED_HTML_ID
      return undefined
    },
    load(id) {
      if (id === RESOLVED_HTML_ID) return load()
      return undefined
    },

    async configureServer(s) {
      s.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if ((url?.includes('.') || url?.includes('@') || url?.includes('virtual:')) && !url?.endsWith('.html')) {
          return next()
        }
        try {
          const html = await s.transformIndexHtml(req.url!, await load())
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          res.end(html)
        } catch (err) {
          next(err as Error)
        }
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler: load,
    },
  }
}

export const shiki = (opts: ViteContext): vite.Plugin => {
  const SHIKI_ID = 'virtual:lickle/shiki'
  const RESOLVED_SHIKI_ID = '\0' + SHIKI_ID

  return {
    name: '@lickle/docs:plugin-shiki',
    enforce: 'pre',
    async resolveId(id, importer) {
      if (importer?.includes('ui/context/markup') && id.includes('languages.')) return RESOLVED_SHIKI_ID
      return undefined
    },
    async load(id) {
      if (id === RESOLVED_SHIKI_ID) {
        const c = await opts.config().then((c) => c.languages ?? ['ts'])
        return `
          ${c.map((l) => `import ${l} from 'shiki/langs/${l}';`).join('\n')}
          export const languages = [${c.map((c) => `{ name: "${c}", import: ${c} }`).join(',\n')}];
        `
      }
      return undefined
    },
    configureServer(s) {
      opts.on(() => {
        const mod = s.moduleGraph.getModuleById(RESOLVED_SHIKI_ID)
        if (mod) {
          s.moduleGraph.invalidateModule(mod)
          s.ws.send({ type: 'full-reload', path: '*' })
        }
      })
    },
  }
}

export const resolve = (opts: ViteContext): vite.Plugin => {
  /** A bare specifier (a package import), not relative/absolute/virtual. */
  const isBareImport = (id: string): boolean =>
    !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0') && !id.includes(':') && !path.isAbsolute(id)

  return {
    name: '@lickle/docs:plugin-imports',
    enforce: 'pre',
    config: () => ({ server: { fs: { allow: [...(opts.dir ? [path.resolve(opts.dir)] : []), libRoot] } } }),
    async resolveId(id, importer, resolveOpts) {
      // When such a bare import can't be resolved from the consumer, fall back to resolving it from lickle-docs
      if (!importer || !isBareImport(id)) return undefined
      const normal = await this.resolve(id, importer, { ...resolveOpts, skipSelf: true })
      if (normal) return undefined
      return (await this.resolve(id, clientFiles.entry.client, { ...resolveOpts, skipSelf: true }))?.id
    },
  }
}
