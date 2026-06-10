import * as vite from 'vite'
import path from 'node:path'
import pc from 'picocolors'
// import pMap from 'p-map'

import * as Core from '../../core/index.ts'
import { Node } from '../../_lib/index.ts'

import type { ServerEntry } from '../entrypoints/entry-server.tsx'
import { createShellStreamer } from '../context/index.ts'
import { createRouter } from '../../core/client/index.ts'

type GenerateStaticOptions = {
  json: Core.Config.ProjectVersion
  outDir: string
  baseUrl: string
  assetsDir: string
  clientEntry: string
  serverOutDir: string
  serverEntry: string
  logger: vite.Logger
  noJavascript?: boolean
}

export const generateStatic = async (opts: GenerateStaticOptions) => {
  opts.logger.info(`\nGenerating static routes...\n`)
  // Client script and css
  const clientManifest = await readManifest(opts.outDir, opts.baseUrl)

  // Project Json script
  const serializedJson = serializeJson(opts.json)
  const hash = Node.hash(serializedJson).slice(0, 8)
  const name = Node.Fs.sanitizeFilename(`project-${opts.json.version ?? ''}-${hash}.js`)
  const outPath = path.resolve(opts.assetsDir, name)
  await Node.Fs.writeFile(outPath, `window.__LICKLE_JSON__ = ${serializedJson}`)
  const jsonHref = prefixSlash(path.join(opts.baseUrl, path.relative(opts.outDir, outPath)))

  // Server script
  const serverManifest = await readManifest(opts.serverOutDir, opts.baseUrl)
  const serverModule = await Node.Jiti.importModule<{ default: ServerEntry }>(serverManifest.entry()!.filePath)

  const router = createRouter({ routes: opts.json.routes, prefix: { doc: opts.json.name.replace(/^@/, ''), page: '' } })
  const shellStreamer = await createShellStreamer(opts.baseUrl)

  const gen = async (route: Core.Router.Route) => {
    const rel = route.slug.replace(/^\/+/, '')
    const isHome = rel === ''
    const outPath = path.join(opts.outDir, isHome ? 'index.html' : rel + '.html')
    await Node.Fs.ensureDir(outPath)

    opts.logger.info(
      `${pc.gray(path.relative(process.cwd(), opts.outDir) + '/')}${pc.blue(path.relative(opts.outDir, outPath))}`,
    )

    const bodyHtml = [`<script type="module" src="${jsonHref}"></script>`]
    if (!opts.noJavascript) bodyHtml.push(`<script type="module" src="${clientManifest.entry()?.href}"></script>`)

    const css = clientManifest.css().map((c) => `<link rel="stylesheet" href="${c.href}" />`)
    const head = [...css, serverModule.default.hydrationScript()].join('\n')

    const fileStream = shellStreamer(outPath, {
      title: isHome ? opts.json.name : route.title,
      head,
      script: bodyHtml.join('\n'),
    })

    // The server Router is mounted with `base`, so route patterns are
    // `${base}/*slug`. Feed it a base-prefixed URL or nothing matches.
    const url = prefixSlash(path.join(opts.baseUrl, route.slug))

    await new Promise<void>((resolve) => {
      const body = serverModule.default.renderToStream(opts.json, url, {
        onCompleteAll: () => resolve(),
      })
      body.pipe(fileStream)
    })

    opts.logger.info(
      `${pc.gray(path.relative(process.cwd(), opts.outDir) + '/')}${pc.green(path.relative(opts.outDir, outPath))}`,
    )
  }

  for (const route of router.items) {
    await gen(route)
  }

  // await pMap(router.items, gen, { concurrency: 10 })

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

const readManifest = async (dir: string, baseUrl: string) => {
  const m = JSON.parse(await Node.Fs.readFile(path.join(dir, '.vite', 'manifest.json'), 'utf8')) as Manifest

  const css = () =>
    Object.values(m)
      .filter((m) => m.css)
      .map((m) => m.css)
      .flat()
      .filter((x) => x !== undefined)
      .map((c) => ({ href: prefixSlash(path.join(baseUrl, c)) }))

  const entry = () => {
    const entry = Object.values(m).find((m) => m.isEntry)
    if (!entry) return
    return { ...entry, filePath: path.join(dir, entry.file), href: prefixSlash(path.join(baseUrl, entry.file)) }
  }

  return { css, entry }
}

// Guard against </script> in string content breaking the inline script, and XSS.
const serializeJson = (json: unknown): string =>
  JSON.stringify(json)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

const prefixSlash = (p: string) => (p.startsWith('/') ? p : `/${p}`)
