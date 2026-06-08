import * as vite from 'vite'

import type { ViteContext } from '../context/index.ts'
import { virtualFile } from './util/index.ts'
import { clientFiles } from '../env.ts'

export const shiki = (opts: ViteContext): vite.Plugin => {
  const File = virtualFile({
    id: 'virtual:lickle/shiki',
    path: clientFiles.virtuals.highlight,
    content: async () => {
      const langs = await opts
        .current()
        .then((c) => Array.from(new Set([...c.languages, ...(c.config.languages ?? []), 'ts'])))

      return `
      ${langs.map((l) => `import ${l} from 'shiki/langs/${l}';`).join('\n')}
      export const languages = [${langs.map((c) => `{ name: "${c}", import: ${c} }`).join(',\n')}];
    `
    },
  })

  return {
    name: '@lickle/docs:plugin-shiki',
    enforce: 'pre',
    resolveId: File.plugin.resolveId,
    load: File.plugin.load,
    configureServer: (s) => opts.on(() => File.invalidate(s, true)),
  }
}
