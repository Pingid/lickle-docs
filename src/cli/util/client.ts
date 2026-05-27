import { fileURLToPath } from 'node:url'
import * as vite from 'vite'
import path from 'node:path'
import fs from 'node:fs'

const docsRoot = fileURLToPath(new URL('../../client/', import.meta.url))
const libRoot = fileURLToPath(new URL('../../', import.meta.url))

export const dev = async (args: { dir: string; port?: number }) => {
  const server = await vite.createServer({
    root: docsRoot,
    configFile: path.join(docsRoot, 'vite.config.ts'),
    plugins: [docsPlugin(args)],
    server: { port: args.port ?? 3000 },
  })
  await server.listen()
  server.printUrls()

  const cleanup = async () => {
    await server.close()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

const docsPlugin = (p: { dir: string; entry?: string }): vite.Plugin => {
  return {
    name: 'docs',
    enforce: 'pre',
    config: () => {
      return {
        resolve: { alias: { '@lickle/docs': path.resolve(libRoot, 'src') } },
        server: { fs: { allow: [docsRoot, libRoot, p.dir] } },
      }
    },
    transformIndexHtml(html) {
      const entry = path.join(p.dir, p.entry ?? 'index.tsx')
      const exists = fs.existsSync(entry)
      if (!exists) return html
      return html.replace('</head>', `<script type="module" src="${entry}"></script>\n</head>`)
    },
  }
}
