import * as vite from 'vite'

import type { ViteContext } from '../context/index.ts'

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
        const c = await opts.config().then((c) => Array.from(new Set(c.languages ?? ['ts'])))
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
