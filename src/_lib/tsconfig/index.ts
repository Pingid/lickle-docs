import { getTsconfig, type TsConfigResult } from 'get-tsconfig'
import path from 'node:path'

export type ResolvedTsconfig = {
  config: TsConfigResult | null
  outDir: string
  rootDir: string
}

export const resolve = (projectDir: string, tsconfig?: string): ResolvedTsconfig => {
  const tsconfigResult = getTsconfig(projectDir, tsconfig) // resolves `extends`, JSONC, etc.
  const opts = tsconfigResult?.config.compilerOptions ?? {}
  const tsconfigDir = tsconfigResult ? path.dirname(tsconfigResult.path) : projectDir
  const outDir = path.resolve(tsconfigDir, opts.outDir ?? 'dist')
  const rootDir = path.resolve(tsconfigDir, opts.rootDir ?? 'src')

  return { outDir, rootDir, config: tsconfigResult }
}
