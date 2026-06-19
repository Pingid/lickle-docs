import path from 'node:path'
import * as vite from 'vite'

import type { ViteContext } from '../context/index.ts'
import { clientFiles } from '../env.ts'

export const resolve = (opts: ViteContext): vite.Plugin => {
  /** A bare specifier (a package import), not relative/absolute/virtual. */
  const isBareImport = (id: string): boolean =>
    !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0') && !id.includes(':') && !path.isAbsolute(id)

  return {
    name: '@lickle/docs:plugin-imports',
    enforce: 'pre',
    config: () => ({ server: { fs: { allow: [...(opts.dir ? [path.resolve(opts.dir)] : []), clientFiles.lib] } } }),
    async resolveId(id, importer, resolveOpts) {
      // When such a bare import can't be resolved from the consumer, fall back to resolving it from lickle-docs
      if (!importer || !isBareImport(id)) return undefined
      const normal = await this.resolve(id, importer, { ...resolveOpts, skipSelf: true })
      if (normal) return undefined
      return (await this.resolve(id, clientFiles.entry.client, { ...resolveOpts, skipSelf: true }))?.id
    },
  }
}
