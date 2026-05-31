import { pathToFileURL } from 'node:url'
import fs from 'node:fs/promises'
import { createJiti } from 'jiti'
import { v } from '@lickle/is'
import path from 'node:path'
import ts from 'typescript'
import fg from 'fast-glob'

import type * as project from '../core/project/index.ts'
import * as lib from '../_lib/index.ts'

import { type ConfigJson } from './types.ts'
import * as defaults from './defaults.ts'
import * as types from './types.ts'

export type * from './types.ts'

const EXT = ['ts', 'mts', 'cts', 'js', 'cjs', 'mjs', 'json']

export const loadGen = async (dir: string = process.cwd(), opts?: Partial<types.ConfigJson>) => {
  const c = await load(dir, opts)
  const gen: project.GenerateOptions = {
    dir,
    exclude: [],
    config: { entrypoints: [], links: [], ...c, routes: [] },
    compilerOptions: c.compilerOptions,
    full: c.full,
  }

  if (c.readme) {
    const page: project.PageType<'markdown'> = {
      kind: 'markdown',
      content: await lib.fs.readFile(c.readme, 'utf-8'),
    }
    gen.config.routes = [{ label: 'Overview', slug: '', page, children: [], nav: true }]
  }
  return gen
}

export const load = async (
  dir: string = process.cwd(),
  opts?: Partial<types.ConfigJson>,
): Promise<types.ConfigJson & { compilerOptions: ts.CompilerOptions }> => {
  const c = lib.tsconfig.resolve(dir)
  if (!c.config) throw new Error('No tsconfig.json found')
  const loaded = await loadFile(dir)
  const info = await defaults.apply(dir, { ...loaded, ...opts })
  const parsed = ts.parseJsonConfigFileContent(c.config, ts.sys, path.dirname(c.config.path))
  return { ...info, compilerOptions: parsed.options }
}

const loadFile = async (dir: string): Promise<ConfigJson | undefined> => {
  const file = await findFile(dir)
  if (!file) return undefined
  if (file.endsWith('.json')) return readJson(file)
  return readCode(file)
}

export const findFile = async (dir: string): Promise<string | undefined> => {
  const ext = EXT.join(',')
  const files = await fg.glob(`lickle.{${ext}}`, { cwd: dir, absolute: true })
  return files?.[0]
}

const readCode = async (file: string): Promise<ConfigJson> => {
  const jti = createJiti(pathToFileURL(import.meta.url).href, {
    moduleCache: false,
    cache: false,
  })
  const mod = await jti.import<{ default: any }>(file)
  const fl = await mod.default
  return valid(fl)
}

const readJson = async (file: string): Promise<ConfigJson> => {
  const content = await fs.readFile(file, 'utf-8')
  const j = JSON.parse(content) as unknown
  return valid(j)
}

const schema = v.struct({
  name: v.string,
  version: v.or(v.string, v.undefined),
  readme: v.or(v.string, v.undefined),
  links: v.or(v.array(v.struct({ label: v.string, href: v.string })), v.undefined),
  tsconfig: v.or(v.string, v.undefined),
  repository: v.or(v.struct({ url: v.string, rev: v.string, fileUrl: v.string }), v.undefined),
  srcDir: v.or(v.string, v.undefined),
  entrypoints: v.or(v.array(v.struct({ as: v.string, path: v.string })), v.undefined),
  exclude: v.or(v.array(v.string), v.undefined),
  full: v.or(v.boolean, v.undefined),
})

const valid = v.assert(schema)
