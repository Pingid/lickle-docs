import * as vite from 'vite'

import type { ViteContext } from '../context/index.ts'
import { Util } from '../../_lib/index.ts'

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
        const mod = s.moduleGraph.getModuleById('\0' + PROJECT_JSON_ID)
        if (mod) s.moduleGraph.invalidateModule(mod)
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
