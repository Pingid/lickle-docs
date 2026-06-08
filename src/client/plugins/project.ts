import * as vite from 'vite'
import pc from 'picocolors'

import type { ViteContext } from '../context/index.ts'
import { virtualFile } from './util/index.ts'
import { clientFiles } from '../env.ts'

export const project = (config: ViteContext): vite.Plugin => {
  const json = virtualFile({
    id: 'virtual:lickle/docs.json',
    path: clientFiles.virtuals.json,
    content: async () => config.current().then((c) => `export default ${JSON.stringify(c.json)}`),
  })

  let logger: vite.Logger | undefined = undefined

  return {
    name: '@lickle/docs:plugin-project',
    enforce: 'pre',
    configResolved(config) {
      logger = config.logger
    },
    resolveId: json.plugin.resolveId,
    load: json.plugin.load,
    configureServer(s) {
      s.watcher.add(config.dir)

      let last = '0'
      const rebuild = async () => {
        logger?.info(pc.yellow('Building docs...'), { timestamp: true })
        const c = await config.rebuild()
        s.watcher.add(c.file)
        const hash = JSON.stringify(c.json)
        if (hash === last) return logger?.info(pc.green('No changes'), { timestamp: true })
        logger?.info(pc.green(`Built ${c.json.routes.items.length} pages`), { timestamp: true })
        last = hash
        s.ws.send({ type: 'custom', event: 'docs-update', data: c.json })
        json.invalidate(s)
      }

      const isProjectFile = (path: string) => {
        if (!path.startsWith(config.dir)) return false
        if (/(\.ts|\.tsx|\.md)$/.test(path)) return true
        if (/package.json$/.test(path)) return true
        return false
      }

      s.watcher.on('change', (changedPath) => isProjectFile(changedPath) && rebuild())
      setTimeout(() => rebuild(), 100)
    },
  }
}
