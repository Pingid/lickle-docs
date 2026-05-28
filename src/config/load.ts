import path from 'node:path'

import type { NewProjectConfig, UserConfig } from './types.ts'
import { reflect, workspace, project } from '../core/index.ts'
import * as def from './defaults.ts'
import * as file from './file.ts'

export const load = async (dir: string = process.cwd()): Promise<NewProjectConfig> => {
  const c = await file.load(dir)
  const config = await def.determine(dir, c ?? undefined)
  return { ...config, ...(await reflectEntrypoints(config, c ?? undefined)) }
}

/** Resolve + reflect every entrypoint into a flat declaration list with stamped names. */
const reflectEntrypoints = async (
  config: NewProjectConfig,
  c: UserConfig | undefined,
): Promise<Pick<NewProjectConfig, 'declarations' | 'children'>> => {
  const files = config.entrypoints.map((e) => path.resolve(config.workdir, e.content))
  if (!files.length) return { declarations: [], children: [] }

  const tsc = await workspace.tsconfig.get(c?.tsconfig)
  const result = reflect.resolve.run(files, { rootDir: config.workdir, compilerOptions: tsc.options })
  project.naming.stamp(result.declarations, result.children)
  return { declarations: result.declarations, children: result.children }
}
