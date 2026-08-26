import path from 'node:path'
import * as vite from 'vite'

import { Node } from '../../_lib/index.ts'

import type { ViteContext } from '../context/index.ts'
import { libRoot } from '../env.ts'

/**
 * Extend Tailwind's source scan to the project being documented.
 *
 * `theme.css` ships with `@source './src'` — the library's own components — so
 * out of the box a consumer's `.tsx` page or `defineComponents` override can
 * only use utilities the library already happens to use. Anything else is
 * silently dropped, which looks like the class was ignored.
 *
 * Rather than a second stylesheet to import, this appends an `@source` for the
 * project to the theme itself as it is loaded, so component pages style
 * themselves with no setup.
 */
export const theme = (opts: ViteContext): vite.Plugin => {
  const themeCss = path.resolve(libRoot, 'theme.css')

  return {
    name: '@lickle/docs:plugin-theme',
    enforce: 'pre',
    async load(id) {
      // Vite appends query suffixes (`?used`, `?direct`) to CSS ids.
      if ((id.split('?')[0] ?? id) !== themeCss) return undefined
      const css = await Node.Fs.readFile(themeCss, 'utf8')
      return `${css}\n/* Added by plugin-theme: scan the documented project too. */\n@source ${JSON.stringify(opts.dir)};\n`
    },
  }
}
