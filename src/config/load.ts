import path from 'node:path'
import ts from 'typescript'

import * as lib from '../_lib/index.ts'

import type * as project from '../core/project/index.ts'

import * as defaults from './defaults.ts'
import * as types from './types.ts'
import * as file from './file.ts'

export type * from './types.ts'

export const load = async (
  dir: string = process.cwd(),
  opts?: Partial<types.ConfigJson>,
): Promise<{ config: types.ConfigJson; compilerOptions: ts.CompilerOptions }> => {
  const c = lib.tsconfig.resolve(dir)
  if (!c.config) throw new Error('No tsconfig.json found')
  const loaded = await file.load(dir)
  const info = await defaults.apply(dir, { ...loaded, ...opts })
  const parsed = ts.parseJsonConfigFileContent(c.config, ts.sys, path.dirname(c.config.path))

  return { config: info, compilerOptions: parsed.options }
}

export const loadGen = async (dir: string = process.cwd(), opts?: Partial<types.ConfigJson>) => {
  const c = await load(dir, opts)
  const gen: project.json.GenerateOptions = {
    dir,
    exclude: [],
    config: { entrypoints: [], links: [], ...c.config, routes: [] },
    compilerOptions: c.compilerOptions,
  }

  if (c.config.readme) {
    const page: project.json.PageType<'markdown'> = {
      kind: 'markdown',
      content: await lib.fs.readFile(c.config.readme, 'utf-8'),
    }
    gen.config.routes = [{ label: 'Overview', slug: '', page, children: [], nav: true }]
  }
  return gen
}
