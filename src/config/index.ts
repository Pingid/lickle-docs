import * as lib from '../_lib/index.ts'

import type { ConfigJson } from './types.ts'
export type * from './types.ts'

export const defineConfig = <C extends ConfigJson | (() => ConfigJson) | (() => Promise<ConfigJson>)>(config: C) => {
  const c = typeof config === 'function' ? config() : config
  return Promise.resolve(c)
}

export const fromExports = async () => lib.pkg.resolveExportedSources(process.cwd(), await lib.pkg.read(process.cwd()))
