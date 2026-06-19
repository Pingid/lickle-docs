import { getTsconfig, type TsConfigJsonResolved } from 'get-tsconfig'
import path from 'node:path'

export type ResolvedTsconfig = {
  config: TsConfigJsonResolved
  path: string
  outDir: string
  rootDir: string
}

export const resolve = (projectDir: string, tsconfig?: string): ResolvedTsconfig => {
  const tsconfigResult = getTsconfig(projectDir, tsconfig) // resolves `extends`, JSONC, etc.
  const opts = tsconfigResult?.config.compilerOptions ?? {}
  const tsconfigDir = tsconfigResult ? path.dirname(tsconfigResult.path) : projectDir
  const outDir = path.resolve(tsconfigDir, opts.outDir ?? 'dist')
  const rootDir = path.resolve(tsconfigDir, opts.rootDir ?? 'src')
  if (!tsconfigResult?.config) throw new Error('No tsconfig.json found')
  return { outDir, rootDir, config: tsconfigResult.config, path: tsconfigResult.path }
}
