import * as vite from 'vite'
import pc from 'picocolors'

import type { DocsJson, DocsVersion } from '../../ui/context/docs/types.ts'

import type { Build } from '../../core/index.ts'

import type { ViteContext } from '../context/index.ts'
import { virtualFile, Coder } from './util/index.ts'
import { clientFiles } from '../env.ts'

export const docs = (config: ViteContext): vite.Plugin => {
  const content = async () => {
    const c = await config.current()
    const d: DocsJson = {
      name: c.config.name,
      links: Coder.json(c.config.links),
      versions: [
        { version: c.config.version!, slug: '/', get: Coder.json(c.json) },
        ...(c.config.versions ?? []).map(
          (v): DocsVersion => ({
            version: v.version!,
            slug: v.slug!,
            get: Coder.inline(`() => import(${JSON.stringify(v.path)}).then((m) => m.default)`),
          }),
        ),
      ],
    }
    return `export default (${Coder.toCode(JSON.stringify(d))})`
  }

  const docs = virtualFile({ id: 'virtual:lickle/docs.ts', path: clientFiles.virtuals.docs, content })

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
        logger?.info(pc.green(`Built ${c.json.pages.length} pages`), { timestamp: true })
        // s.ws.send({ type: 'custom', event: 'docs-update', data: c.json })
        docs.invalidate(s)
        s.ws.send({ type: 'full-reload', path: clientFiles.virtuals.docs })
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
