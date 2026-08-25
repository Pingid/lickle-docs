import path from 'node:path'
import * as vite from 'vite'

import { Node } from '../../_lib/index.ts'
import { Llms } from '../../core/index.ts'

import type { ViteContext } from '../context/index.ts'

/**
 * Emit and serve the plain-text view of the site — `llms.txt`, `llms-full.txt`
 * and a `.md` per page — so a model can read the docs without executing them.
 *
 * The same plugin covers both halves: `writeBundle` puts the files in the
 * output directory for a build, and `configureServer` serves them from memory
 * in dev, so `curl localhost:5173/llms.txt` works while you are still writing.
 */
export const llms = (opts: ViteContext): vite.Plugin => {
  let isSsr = false
  let outDir = ''

  const files = async () => {
    const current = await opts.current()
    const config = current.config as { llms?: unknown; site?: string }
    const settings = resolve(config.llms)
    if (!settings) return []
    return Llms.llmsFiles(current.json, { site: config.site, ...settings })
  }

  return {
    name: '@lickle/docs:plugin-llms',

    configResolved(resolved) {
      // `shared()` hands the same plugin list to both SSG passes; only the
      // client one owns the output directory a reader will fetch from.
      isSsr = !!resolved.build.ssr
      outDir = resolved.build.outDir
    },

    async writeBundle() {
      if (isSsr) return
      for (const file of await files()) {
        const target = path.join(outDir, file.path)
        await Node.Fs.ensureDirFor(target)
        await Node.Fs.writeFile(target, file.content)
      }
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0] ?? ''
        const wanted = decodeURIComponent(url.replace(/^\/+/, ''))
        if (!wanted.endsWith('.txt') && !wanted.endsWith('.md')) return next()

        const match = (await files()).find((f) => f.path === wanted)
        if (!match) return next()

        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(match.content)
      })
    },
  }
}

/** Normalize the `llms` config into the generator's options, or `false` to skip. */
const resolve = (
  value: unknown,
): { index?: boolean; full?: boolean; pages?: boolean; description?: string } | undefined => {
  if (value === false) return undefined
  if (value === true || value === undefined) return {}
  return value as { index?: boolean; full?: boolean; pages?: boolean; description?: string }
}
