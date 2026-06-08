import path from 'node:path'
import * as vite from 'vite'

import { htmlShellGenerator, type ViteContext } from '../context/index.ts'
import { clientFiles } from '../env.ts'

export const html = (opts: ViteContext): vite.Plugin => {
  const RESOLVED_HTML_ID = path.join(clientFiles.root, 'index.html')

  const htmlShell = htmlShellGenerator()
  const load = async () => {
    const json = await opts.json()
    const html = (await htmlShell)({
      body: '<div id="root"></div>',
      head: '<script type="module" src="/entry.tsx"></script>',
      title: json.name,
    })
    return html
  }

  return {
    name: '@lickle/docs:plugin-html',
    enforce: 'pre',
    resolveId(id) {
      if (id.endsWith('index.html') || id.endsWith('/index.html')) return RESOLVED_HTML_ID
      return undefined
    },
    load(id) {
      if (id === RESOLVED_HTML_ID) return load()
      return undefined
    },

    async configureServer(s) {
      s.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if ((url?.includes('.') || url?.includes('@') || url?.includes('virtual:')) && !url?.endsWith('.html')) {
          return next()
        }
        try {
          const html = await s.transformIndexHtml(req.url!, await load())
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          res.end(html)
        } catch (err) {
          next(err as Error)
        }
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler: load,
    },
  }
}
