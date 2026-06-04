import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import fg from 'fast-glob'

import type * as project from '../core/project/index.ts'
import * as lib from '../_lib/index.ts'

import { type Entry, type Link, type UserConfig } from './types.ts'
import * as defaults from './defaults.ts'
import * as types from './types.ts'

export type * from './types.ts'

const EXT = ['ts', 'mts', 'cts', 'js', 'cjs', 'mjs', 'json']

export const loadGen = async (dir: string = process.cwd(), opts?: Partial<types.UserConfig>) => {
  const c = await load(dir, opts)
  return toGenerateOptions(c)
}

export type PreparedConfig = {
  rootDir: string
  links: Link[]
  config: UserConfig
  compilerOptions: ts.CompilerOptions
  routes: project.RouteNode[]
  entrypoints: Entry[]
  exclude: string[]
}

export const toGenerateOptions = async (c: PreparedConfig): Promise<PreparedConfig> => {
  if (c.config.readme) {
    const page: project.PageType<'markdown'> = {
      kind: 'markdown',
      content: await lib.fs.readFile(c.config.readme, 'utf-8'),
    }
    c.routes.push({ label: 'README', slug: 'readme', page, children: [], sidebar: true })
  }

  return c
}

export const load = async (dir: string = process.cwd(), opts?: Partial<types.UserConfig>): Promise<PreparedConfig> => {
  const c = lib.tsconfig.resolve(dir)
  if (!c.config) throw new Error('No tsconfig.json found')
  const loaded = await loadFile(dir)
  const info = await defaults.apply(dir, { ...loaded, ...opts })
  const parsed = ts.parseJsonConfigFileContent(c.config, ts.sys, path.dirname(c.config.path))

  return {
    links: info.links ?? [],
    config: info,
    exclude: info.exclude ?? [],
    compilerOptions: parsed.options,
    routes: [],
    entrypoints: info.entrypoints ?? [],
    rootDir: process.cwd(),
  }
}

const loadFile = async (dir: string): Promise<UserConfig | undefined> => {
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

const readCode = async (file: string): Promise<UserConfig> => {
  const mod = await lib.jiti.importModule<{ default: any }>(file)
  return types.validate(await mod.default)
}

const readJson = async (file: string): Promise<UserConfig> => {
  const content = await fs.readFile(file, 'utf-8')
  const j = JSON.parse(content) as unknown
  return types.validate(j)
}
