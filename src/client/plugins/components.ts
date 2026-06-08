import path from 'node:path'
import * as vite from 'vite'

import type { ViteContext } from '../context/index.ts'

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
