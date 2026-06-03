import * as vite from 'vite'
import path from 'node:path'

import type * as core from '../../../../core/index.ts'
import * as lib from '../../../../_lib/index.ts'

import { libRoot } from '../../../env.ts'
import { flattenSlugs } from './slugs.ts'
import { htmlShell } from './shell.ts'

const viteRoot = path.resolve(libRoot, 'client')

export const buildStatic = async (opts: {
  json: core.project.ProjectJson
  clientVite: vite.InlineConfig
  serverVite: vite.InlineConfig
}) => {
  const outDir = opts.clientVite.build?.outDir
  if (!outDir) throw new Error('outDir is required')
  const base = opts.clientVite.base ?? '/'
  const json = opts.json

  const clientTempOut = outDir
  const serverTempOut = path.join(outDir, '.temp/server')

  // 1. CLIENT build — emits hashed assets + manifest, hydration entry as input
  await Promise.all([
    vite.build({
      ...opts.clientVite,
      build: {
        ...opts.clientVite.build,
        outDir: clientTempOut,
        manifest: true,
        rollupOptions: {
          input: path.resolve(viteRoot, 'entry-client.tsx'),
        },
      },
    }),

    // 2. SSR build — bundles entry-server for Node, externalizes deps
    vite.build({
      ...opts.serverVite,
      build: {
        ...opts.serverVite.build,
        outDir: serverTempOut,
        ssr: path.resolve(viteRoot, 'entry-server.tsx'),
        rollupOptions: { output: { format: 'esm' } },
      },
    }),
  ])

  // // 3. read the client manifest to find hashed entry + css
  const manifest = await readManifest(path.join(clientTempOut, '.vite', 'manifest.json'))
  const entry = manifest['entry-client.tsx']
  const clientSrc = base + (entry?.file ?? '')
  const cssHref = base + (entry?.css?.[0] ?? '')

  const { renderPage } = await import(path.join(serverTempOut, 'entry-server.js'))

  const slugs = flattenSlugs(json.routes)

  await lib.fs.writeFile(path.join(outDir, 'assets', 'json.js'), `window.__LICKLE_JSON__ = ${serializeJson(json)}`)
  const projectScript = `<script type="module" src="/assets/json.js"></script>`

  for (const slug of slugs) {
    const url = '/' + slug
    const { body, head } = await renderPage(json, url)
    const html = htmlShell({ body, head, json, clientSrc, cssHref, base, projectScript })

    const outPath = path.join(outDir, slug || 'index') + '.html'
    await lib.fs.mkdir(path.dirname(outPath), { recursive: true })
    await lib.fs.writeFile(outPath, html)
  }
}

type ManifestChunk = {
  file: string
  name?: string
  src?: string
  isEntry?: boolean
  css?: string[]
  imports?: string[]
  dynamicImports?: string[]
}
type Manifest = Record<string, ManifestChunk>

const readManifest = async (manifestPath: string): Promise<Manifest> =>
  JSON.parse(await lib.fs.readFile(manifestPath, 'utf8')) as Manifest

// Guard against </script> in string content breaking the inline script, and XSS.
const serializeJson = (json: unknown): string =>
  JSON.stringify(json)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
