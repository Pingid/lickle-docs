import * as lib from '../_lib/index.ts'
import type { UserConfig } from './types.ts'

export const defineConfig = (config: UserConfig | (() => UserConfig) | (() => Promise<UserConfig>)) => {
  const c = typeof config === 'function' ? config() : config
  return Promise.resolve(c)
}

export namespace entrypoints {
  export const fromExports = async () =>
    lib.pkg.resolveExportedSources(process.cwd(), await lib.pkg.read(process.cwd()))
}
