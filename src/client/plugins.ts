import * as vite from 'vite'

import path from 'node:path'

import * as Lib from '../_lib/index.ts'

import type { ViteContext } from './contex.ts'
import { clientFiles } from './env.ts'

export const project = (config: ViteContext): vite.Plugin => {
  const PROJECT_JSON_ID = 'virtual:lickle/docs.json'
  let logger: vite.Logger | undefined = undefined

  /** A bare specifier (a package import), not relative/absolute/virtual. */
  const isBareImport = (id: string): boolean =>
    !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0') && !id.includes(':') && !path.isAbsolute(id)

  return {
    name: '@lickle/docs:project-plugin',
    enforce: 'pre',
    configResolved(config) {
      logger = config.logger
    },
    async resolveId(id, importer, resolveOpts) {
      if (id === PROJECT_JSON_ID) return '\0' + PROJECT_JSON_ID
      // When such a bare import can't be resolved from the consumer, fall back to resolving it from lickle-docs
      if (!importer || !isBareImport(id)) return undefined
      const normal = await this.resolve(id, importer, { ...resolveOpts, skipSelf: true })
      if (normal) return undefined
      return (await this.resolve(id, clientFiles.entry.client, { ...resolveOpts, skipSelf: true }))?.id
    },

    async load(id) {
      if (id !== '\0' + PROJECT_JSON_ID) return undefined
      return JSON.stringify(await config.json())
    },

    configureServer(s) {
      if (!config.config) return

      s.watcher.add([config.dir])

      const handleJson = async () => {
        await config.rebuild()
        const json = await config.json()

        s.ws.send({ type: 'custom', event: 'docs-update', data: json })
        logger?.info('Docs built successfully', { timestamp: true })
      }

      const isProjectFile = (path: string) => {
        if (!path.startsWith(config.dir)) return false
        if (/(\.ts|\.tsx|\.md)$/.test(path)) return true
        if (/package.json$/.test(path)) return true
        return false
      }

      const rebuild = Lib.util.serial(() => handleJson())
      s.watcher.on('change', (changedPath) => isProjectFile(changedPath) && rebuild())
      rebuild()
    },
  }
}

export const components = (opts: ViteContext): vite.Plugin => {
  const CUSTOM_COMPONENTS_ID = 'virtual:lickle/custom-components'
  return {
    name: '@lickle/docs:components-plugin',
    config: () => ({ server: { fs: { allow: [...(opts.dir ? [path.resolve(opts.dir)] : [])] } } }),
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
  name: '@lickle/docs:ignore-css',
  enforce: 'pre',
  load: (id) => (/\.(css|scss|sass|less|styl)(\?|$)/.test(id) ? '' : undefined),
})
