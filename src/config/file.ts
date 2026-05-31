import { pathToFileURL } from 'node:url'
import { createJiti } from 'jiti'
import fs from 'node:fs/promises'
import { v } from '@lickle/is'
import fg from 'fast-glob'

import { type ConfigJson } from './types.ts'

const EXT = ['ts', 'mts', 'cts', 'js', 'cjs', 'mjs', 'json']

export const load = async (dir: string): Promise<ConfigJson | undefined> => {
  const file = await find(dir)
  if (!file) return undefined
  if (file.endsWith('.json')) return readJson(file)
  return readCode(file)
}

const find = async (dir: string): Promise<string | undefined> => {
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
