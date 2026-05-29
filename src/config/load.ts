import { findTsconfig, parseTsconfig } from 'get-tsconfig'
import path from 'node:path'
import ts from 'typescript'

import type { ProjectJson } from '../core/client.ts'

import * as defaults from './defaults.ts'
import * as file from './file.ts'

export const load = async (
  dir: string = process.cwd(),
): Promise<{ info: ProjectJson; compilerOptions: ts.CompilerOptions }> => {
  const tsConfigPath = await findTsconfig(dir)
  if (!tsConfigPath) throw new Error('No tsconfig.json found')
  const tsConfigParsed = await parseTsconfig(tsConfigPath)

  const parsed = ts.parseJsonConfigFileContent(tsConfigParsed, ts.sys, path.dirname(tsConfigPath))
  const info = await defaults.apply(dir, await file.load(dir))

  return { info, compilerOptions: parsed.options }
}
