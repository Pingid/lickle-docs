import * as vite from 'vite'

import { htmlShellGenerator, type ViteContext } from '../context/index.ts'
import { clientFiles } from '../env.ts'

export const html = (opts: ViteContext): vite.Plugin => {
  const htmlShell = htmlShellGenerator()

  const load = async () => {
    const c = await opts.current()
    const html = (await htmlShell)({
      body: '<div id="root"></div>',
      head: `<script type="module" src="${clientFiles.entry.main}"></script>`,
      title: c.json.name,
    })
    return html
  }

  return {
    name: '@lickle/docs:plugin-html',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      handler: load,
    },
  }
}
