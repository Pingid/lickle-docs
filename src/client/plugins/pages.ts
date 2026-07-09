import path from 'node:path'
import * as vite from 'vite'

import type { ComponentPage } from '../../core/layout/types.ts'
import type { ViteContext } from '../context/index.ts'
import { virtualFile } from './util/index.ts'
import { clientFiles } from '../env.ts'

/**
 * Generate the component-page module map: every `component` page in the built
 * site becomes one dynamic `import()`, keyed by the same project-relative path
 * the page data carries. Dynamic rather than static so each page is its own
 * chunk — a docs site with twenty interactive pages should not ship twenty
 * pages' worth of JavaScript to read one.
 */
export const pages = (opts: ViteContext): vite.Plugin => {
  const File = virtualFile({
    id: 'virtual:lickle/pages',
    path: clientFiles.virtuals.pages,
    content: async () => {
      const current = await opts.current()
      const modules = current.json.pages
        .filter((p): p is ComponentPage => p.kind === 'component')
        .map((p) => p.module)

      const unique = [...new Set(modules)].sort()
      if (!unique.length) return `export default {};\n`

      const entries = unique.map((m) => {
        const abs = path.resolve(opts.dir, m)
        return `  ${JSON.stringify(m)}: () => import(${JSON.stringify(abs)}),`
      })
      return `export default {\n${entries.join('\n')}\n};\n`
    },
  })

  return {
    name: '@lickle/docs:plugin-pages',
    enforce: 'pre',
    resolveId: File.plugin.resolveId,
    load: File.plugin.load,
    configureServer(server) {
      // The map is derived from the built site, so it has to be re-emitted
      // whenever a rebuild adds or removes a `.tsx` page.
      opts.on(() => File.invalidate(server, true))
    },
  }
}
