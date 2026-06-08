import * as vite from 'vite'

import type { ViteContext } from '../context/index.ts'
import { virtualFile } from './util/index.ts'
import { clientFiles } from '../env.ts'

export const versions = (config: ViteContext): vite.Plugin => {
  const VersionsFile = virtualFile({
    id: 'virtual:lickle/docs.versions',
    path: clientFiles.virtuals.versions,
    content: async () => {
      const c = await config.current()

      const others = (c.config.versions ?? []).map((v) => {
        const alias = v.alias ? `alias: ${JSON.stringify(v.alias)}, ` : ''
        return `{ version: ${JSON.stringify(v.version)}, slug: ${JSON.stringify(v.slug)}, ${alias}get: () => import(${JSON.stringify(v.path)}).then((m) => m.default) }`
      })

      return `
        import docs from ${JSON.stringify(clientFiles.virtuals.json)};
        const current = { version: ${JSON.stringify(c.config.version)}, slug: "/", get: () => docs };
        export default [current, ${others.join(',')}]
      `
    },
  })

  return VersionsFile.plugin
}
