import path from 'node:path'
import * as vite from 'vite'

import type { ViteContext } from '../context/index.ts'
import { virtualFile } from './util/index.ts'
import { clientFiles } from '../env.ts'

export const components = (opts: ViteContext): vite.Plugin => {
  const File = virtualFile({
    id: 'virtual:lickle/custom-components',
    path: clientFiles.virtuals.components,
    content: async () => {
      const c = await opts.current().then((c) => c.config.components)
      if (!c) return `export default {};\n`
      return `export { default } from ${JSON.stringify(path.resolve(opts.dir, c))}\n`
    },
  })
  return {
    name: '@lickle/docs:plugin-components',
    enforce: 'pre',
    resolveId: File.plugin.resolveId,
    load: File.plugin.load,
  }
}
