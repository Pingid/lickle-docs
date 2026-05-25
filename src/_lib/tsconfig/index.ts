import { getTsconfig, type TsConfigResult } from 'get-tsconfig'
import path from 'node:path'

import { memo1 } from '../util/index.ts'

export type ResolvedTsconfig = {
  config: TsConfigResult | null
  outDir: string
  rootDir: string
}

export const resolve = memo1((projectDir: string): ResolvedTsconfig => {
  const tsconfigResult = getTsconfig(projectDir) // resolves `extends`, JSONC, etc.
  const opts = tsconfigResult?.config.compilerOptions ?? {}
  const tsconfigDir = tsconfigResult ? path.dirname(tsconfigResult.path) : projectDir
  const outDir = path.resolve(tsconfigDir, opts.outDir ?? 'dist')
  const rootDir = path.resolve(tsconfigDir, opts.rootDir ?? 'src')

  return { outDir, rootDir, config: tsconfigResult }
})
