import fs from 'node:fs/promises'
import fg from 'fast-glob'

import { Node, TsConfig } from '../../_lib/index.ts'

import { populate } from './populate.ts'
import { validate } from './check.ts'
import * as T from './types.ts'

export type * from './types.ts'

const EXT = ['ts', 'mts', 'cts', 'js', 'cjs', 'mjs', 'json']

export type ResolvedConfig = { config: T.Config; ts: TsConfig.ResolvedTsconfig; file?: string }

export const load = async (dir: string, opts?: Partial<T.UserConfig>): Promise<ResolvedConfig> => {
  const config = await loadFile(dir)
  return populate(dir, { ...config?.config, ...opts })
}

const loadFile = async (dir: string): Promise<{ config: Partial<T.UserConfig>; file: string } | undefined> => {
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

const readCode = async (file: string): Promise<{ config: Partial<T.UserConfig>; file: string }> => {
  const mod = await Node.Jiti.importModule<{ default: any }>(file)
  return { config: validate(await mod.default), file }
}

const readJson = async (file: string): Promise<{ config: Partial<T.UserConfig>; file: string }> => {
  const content = await fs.readFile(file, 'utf-8')
  const j = JSON.parse(content) as unknown
  return { config: validate(j), file }
}

/**
 * Watch a config in `dir`, reloading on change. Until a config file exists the
 * whole `dir` is watched; once one is found the watch narrows to that file.
 */
export const watcher = async (
  dir: string,
  opts?: Partial<T.UserConfig>,
): Promise<{ stop: () => void; config: () => Promise<ResolvedConfig> }> => {
  let cached = load(dir, opts)
  let handle: Node.Fs.Handle | undefined
  let target = ''

  const watch = (path: string) => {
    if (path === target) return
    target = path
    handle?.stop()
    handle = Node.Fs.watchPaths([path], onChange)
  }

  const onChange = async () => {
    cached = load(dir, opts)
    const file = await findFile(dir)
    if (file) watch(file)
  }

  watch((await findFile(dir)) ?? dir)
  return { stop: () => handle?.stop(), config: () => cached }
}
