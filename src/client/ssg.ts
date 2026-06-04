import * as vite from 'vite'
import path from 'node:path'
import pc from 'picocolors'

import * as Core from '../core/index.ts'
import * as Lib from '../_lib/index.ts'

import { htmlShellGenerator } from './contex.ts'

type GenerateStaticOptions = {
  json: Core.project.ProjectJson
  outDir: string
  baseUrl: string
  assetsDir: string
  clientEntry: string
  serverOutDir: string
  serverEntry: string
  logger: vite.Logger
  noJavascript?: boolean
}

type RenderPage = (json: Core.project.ProjectJson, url: string) => Promise<{ body: string; head: string }>

export const generateStatic = async (opts: GenerateStaticOptions) => {
  opts.logger.info(`\nGenerating static routes...\n`)
  // Client script and css
  const manifest = await readManifest(path.join(opts.outDir, '.vite', 'manifest.json'))
  const entry = manifest[path.basename(opts.clientEntry)]
  const clientSrc = prefixSlash(path.join(opts.baseUrl, entry?.file ?? ''))
  const cssHref = prefixSlash(path.join(opts.baseUrl, entry?.css?.[0] ?? ''))

  // Project Json script
  const serializedJson = serializeJson(opts.json)
  const hash = Lib.util.hash(serializedJson).slice(0, 8)
  const name = Lib.fs.sanitizeFilename(`project-${opts.json.version ?? ''}-${hash}.js`)
  const outPath = path.resolve(opts.assetsDir, name)
  await Lib.fs.writeFile(outPath, `window.__LICKLE_JSON__ = ${serializedJson}`)
  const jsonHref = prefixSlash(path.relative(opts.outDir, outPath))

  // Server script
  const serverManifest = await readManifest(path.join(opts.serverOutDir, '.vite', 'manifest.json'))
  const serverEntry = serverManifest[path.basename(opts.serverEntry)]?.file
  const serverSrc = path.resolve(opts.serverOutDir, serverEntry ?? '')

  const { renderPage } = await Lib.jiti.importModule<{ renderPage: RenderPage }>(serverSrc)
  const htmlShell = await htmlShellGenerator()

  const routes = Core.project.flattenRoutes(opts.json.routes)

  for (const route of routes) {
    const { body, head } = await renderPage(opts.json, prefixSlash(route.slug))

    const bodyHtml = [`<div id="root">${body}</div>`, `<script type="module" src="${jsonHref}"></script>`]
    if (!opts.noJavascript) bodyHtml.push(`<script type="module" src="${clientSrc}"></script>`)

    const html = htmlShell({
      body: bodyHtml.join('\n'),
      head: [`<link rel="stylesheet" href="${cssHref}" />`, head].join('\n'),
      title: isRouteRoot(route) ? opts.json.name : route.page.kind === 'markdown' ? route.label : route.page.qualified,
    })

    const outPath = path.join(opts.outDir, isRouteRoot(route) ? 'index.html' : route.slug + '.html')

    await Lib.fs.ensureDir(outPath)
    await Lib.fs.writeFile(outPath, html)
    opts.logger.info(
      `${pc.gray(path.relative(process.cwd(), opts.outDir) + '/')}${pc.green(path.relative(opts.outDir, outPath))}`,
    )
  }

  await Lib.fs.rm(opts.serverOutDir, { recursive: true })
  await Lib.fs.rm(path.join(opts.outDir, '.vite'), { recursive: true })
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
  JSON.parse(await Lib.fs.readFile(manifestPath, 'utf8')) as Manifest

// Guard against </script> in string content breaking the inline script, and XSS.
const serializeJson = (json: unknown): string =>
  JSON.stringify(json)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

const prefixSlash = (p: string) => (p.startsWith('/') ? p : `/${p}`)

const isRouteRoot = (route: Core.project.RouteNode) => {
  const s = route.slug.trim()
  return s === '/' || s === ''
}
