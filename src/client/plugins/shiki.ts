import * as vite from 'vite'

import { SHIKI_LANGUAGES_SET } from '../../core/config/check.ts'
import type { ViteContext } from '../context/index.ts'
import { virtualFile } from './util/index.ts'
import { clientFiles } from '../env.ts'

export const shiki = (opts: ViteContext): vite.Plugin => {
  const File = virtualFile({
    id: 'virtual:lickle/shiki',
    path: clientFiles.virtuals.languages,
    content: async () => {
      const c = await opts.current()
      const wanted = Array.from(new Set([...c.languages, ...(c.config.languages ?? []), 'ts']))
      const langs = wanted.filter((l) => SHIKI_LANGUAGES_SET.has(l))

      // Say so rather than dropping it: an unhighlighted fence looks like a
      // theme problem, not a config one, so a silent filter here is expensive
      // to track down.
      const unknown = wanted.filter((l) => !SHIKI_LANGUAGES_SET.has(l))
      if (unknown.length)
        console.warn(
          `[shiki] Unknown language${unknown.length > 1 ? 's' : ''} ${unknown.map((l) => `'${l}'`).join(', ')} — ` +
            `code in ${unknown.length > 1 ? 'those languages' : 'that language'} will render unhighlighted.`,
        )

      return `
      ${langs.map((l) => `import ${l} from 'shiki/langs/${l}';`).join('\n')}
      const languages = [${langs.map((c) => `{ name: "${c}", import: ${c} }`).join(',\n')}];
      export default languages
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
