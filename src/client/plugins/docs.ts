import * as vite from 'vite'
import pc from 'picocolors'

import type { Build } from '../../core/index.ts'

import type { ViteContext } from '../context/index.ts'
import { virtualFile } from './util/index.ts'
import { clientFiles } from '../env.ts'

export const docs = (config: ViteContext): vite.Plugin => {
  const docs = virtualFile({
    id: 'virtual:lickle/docs.ts',
    path: clientFiles.virtuals.docs,
    content: async () => {
      const c = await config.current()
      const others = (c.config.versions ?? []).map((v) => {
        const alias = v.alias ? `alias: ${JSON.stringify(v.alias)}, ` : ''
        return `{ version: ${JSON.stringify(v.version)}, slug: ${JSON.stringify(v.slug)}, ${alias} get: () => import(${JSON.stringify(v.path)}).then((m) => m.default) }`
      })

      return `
        const current = { version: ${JSON.stringify(c.config.version)}, slug: "/", get: ${JSON.stringify(c.json)} };
        const versions = [current, ${others.join(',')}];
        export default { versions };
      `
    },
  })

  let logger: vite.Logger | undefined = undefined

  return {
    name: '@lickle/docs:plugin-docs',
    enforce: 'pre',
    configResolved(config) {
      logger = config.logger
    },
    resolveId: docs.plugin.resolveId,
    load: docs.plugin.load,
    configureServer(s) {
      const hasChanged = changeDetector()
      s.watcher.add(config.dir)

      const rebuild = debounce(50, async () => {
        logger?.info(pc.yellow('Building docs...'), { timestamp: true })
        await config.rebuild()
        const c = await config.current()
        s.watcher.add(c.file)
        if (!hasChanged(c)) return logger?.info(pc.green('No changes'), { timestamp: true })
        logger?.info(pc.green(`Built ${c.json.routes.items.length} pages`), { timestamp: true })
        s.ws.send({ type: 'custom', event: 'docs-update', data: c.json })
        docs.invalidate(s)
      })

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

const debounce = (ms: number, fn: () => void) => {
  let timeout: NodeJS.Timeout | undefined
  return () => {
    clearTimeout(timeout)
    timeout = setTimeout(fn, ms)
  }
}

const changeDetector = () => {
  let last = '0'
  return (c: Build.BuildResult) => {
    const hash = JSON.stringify(c)
    if (hash === last) return false
    last = hash
    return true
  }
}
