import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import solid from 'vite-plugin-solid'
import * as vite from 'vite'
import path from 'node:path'
import fs from 'node:fs'

const viteRoot = fileURLToPath(new URL('.', import.meta.url))
// const uiRoot = fileURLToPath(new URL('../../../ui/', import.meta.url))
const libRoot = fileURLToPath(new URL('../../../../', import.meta.url))

export const dev = async (args: { docsDir: string; name: string; port?: number }) => {
  const server = await vite.createServer({
    root: viteRoot,
    plugins: [solid(), tailwindcss(), docsPlugin(args)],
    server: { port: args.port },
  })
  await server.listen()
  server.printUrls()

  return server
}

export const build = async (args: { docsDir: string; outDir: string; name: string }) =>
  vite.build({
    root: viteRoot,
    plugins: [solid(), tailwindcss(), docsPlugin(args)],
    build: { outDir: args.outDir, emptyOutDir: true },
    forceOptimizeDeps: true,
  })

const docsPlugin = (p: { docsDir: string; name: string; entry?: string }): vite.Plugin => {
  return {
    name: 'docs',
    enforce: 'pre',
    config: () => {
      return {
        resolve: {
          alias: {
            '@lickle/docs/preset': path.resolve(libRoot, './src/solidjs/entry.tsx'),
            '@lickle/docs/theme.css': path.resolve(libRoot, 'theme.css'),
            // '@lickle/docs': path.resolve(uiRoot, 'index.ts'),
          },
        },
        server: { fs: { allow: [libRoot, p.docsDir] } },
      }
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => {
        const entry = path.join(p.docsDir, p.entry ?? 'index.tsx')
        const exists = fs.existsSync(entry)
        if (!exists) return html
        return html
          .replace('</head>', `<script type="module" src="${entry}"></script>\n</head>`)
          .replace('title>lickle-docs</title>', `title>${p.name}</title>`)
      },
    },
  }
}
