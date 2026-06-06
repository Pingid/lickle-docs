import * as vite from 'vite'
import path from 'node:path'
import pc from 'picocolors'

import * as Core from '../core/index.ts'
import { Node } from '../_lib/index.ts'

import { htmlShellGenerator } from './contex.ts'

type GenerateStaticOptions = {
  json: Core.Config.ProjectJson
  outDir: string
  baseUrl: string
  assetsDir: string
  clientEntry: string
  serverOutDir: string
  serverEntry: string
  logger: vite.Logger
  noJavascript?: boolean
}

type RenderPage = (json: Core.Config.ProjectJson, url: string) => Promise<{ body: string; head: string }>

export const generateStatic = async (opts: GenerateStaticOptions) => {
  opts.logger.info(`\nGenerating static routes...\n`)
  // Client script and css
  const manifest = await readManifest(path.join(opts.outDir, '.vite', 'manifest.json'))
  const entry = manifest[path.basename(opts.clientEntry)]
  const clientSrc = prefixSlash(path.join(opts.baseUrl, entry?.file ?? ''))
  const cssHref = prefixSlash(path.join(opts.baseUrl, entry?.css?.[0] ?? ''))

  // Project Json script
  const serializedJson = serializeJson(opts.json)
  const hash = Node.hash(serializedJson).slice(0, 8)
  const name = Node.Fs.sanitizeFilename(`project-${opts.json.version ?? ''}-${hash}.js`)
  const outPath = path.resolve(opts.assetsDir, name)
  await Node.Fs.writeFile(outPath, `window.__LICKLE_JSON__ = ${serializedJson}`)
  const jsonHref = prefixSlash(path.relative(opts.outDir, outPath))

  // Server script
  const serverManifest = await readManifest(path.join(opts.serverOutDir, '.vite', 'manifest.json'))
  const serverEntry = serverManifest[path.basename(opts.serverEntry)]?.file
  const serverSrc = path.resolve(opts.serverOutDir, serverEntry ?? '')

  const { renderPage } = await Node.Jiti.importModule<{ renderPage: RenderPage }>(serverSrc)
  const htmlShell = await htmlShellGenerator()

  for (const route of opts.json.routes) {
    // The base route (`/` or empty) owns `index.html`; others map their slug to
    // a `<slug>.html` file (a leading slash would break the filename).
    const rel = route.slug.replace(/^\/+/, '')
    const isHome = rel === ''
    const { body, head } = await renderPage(opts.json, prefixSlash(route.slug))

    const bodyHtml = [`<div id="root">${body}</div>`, `<script type="module" src="${jsonHref}"></script>`]
    if (!opts.noJavascript) bodyHtml.push(`<script type="module" src="${clientSrc}"></script>`)

    const html = htmlShell({
      body: bodyHtml.join('\n'),
      head: [`<link rel="stylesheet" href="${cssHref}" />`, head].join('\n'),
      title: isHome ? opts.json.name : route.title,
    })

    const outPath = path.join(opts.outDir, isHome ? 'index.html' : rel + '.html')

    await Node.Fs.ensureDir(outPath)
    await Node.Fs.writeFile(outPath, html)
    opts.logger.info(
      `${pc.gray(path.relative(process.cwd(), opts.outDir) + '/')}${pc.green(path.relative(opts.outDir, outPath))}`,
    )
  }

  await Node.Fs.rm(opts.serverOutDir, { recursive: true })
  await Node.Fs.rm(path.join(opts.outDir, '.vite'), { recursive: true })
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
  JSON.parse(await Node.Fs.readFile(manifestPath, 'utf8')) as Manifest

// Guard against </script> in string content breaking the inline script, and XSS.
const serializeJson = (json: unknown): string =>
  JSON.stringify(json)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

const prefixSlash = (p: string) => (p.startsWith('/') ? p : `/${p}`)
