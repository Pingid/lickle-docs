import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import fg from 'fast-glob'

import type * as project from '../core/project/index.ts'
import { Node, TsConfig } from '../_lib/index.ts'

import { type Entry, type Link, type UserConfig } from './types.ts'
import * as defaults from './defaults.ts'
import * as types from './types.ts'

export type * from './types.ts'

const EXT = ['ts', 'mts', 'cts', 'js', 'cjs', 'mjs', 'json']

export type PreparedConfig = {
  rootDir: string
  links: Link[]
  config: UserConfig
  compilerOptions: ts.CompilerOptions
  routes: project.RouteNode[]
  entrypoints: Entry[]
  exclude: string[]
}

export const load = async (dir: string = process.cwd(), opts?: Partial<types.UserConfig>): Promise<PreparedConfig> => {
  const c = TsConfig.resolve(dir)
  if (!c.config) throw new Error('No tsconfig.json found')
  const loaded = await loadFile(dir)
  const info = await defaults.apply(dir, { ...loaded, ...opts })
  const parsed = ts.parseJsonConfigFileContent(c.config, ts.sys, path.dirname(c.config.path))

  const routes: project.RouteNode[] = []
  if (info.pages?.length) {
    for (const p of info.pages) {
      const page: project.PageType<'markdown'> = {
        kind: 'markdown',
        content: await Node.Fs.readFile(p.content, 'utf-8'),
      }
      routes.push({ label: p.title, slug: p.slug, page, children: [], sidebar: true })
    }
  }

  return {
    links: info.links ?? [],
    config: info,
    exclude: info.exclude ?? [],
    compilerOptions: parsed.options,
    routes,
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
  const mod = await Node.Jiti.importModule<{ default: any }>(file)
  return types.validate(await mod.default)
}

const readJson = async (file: string): Promise<UserConfig> => {
  const content = await fs.readFile(file, 'utf-8')
  const j = JSON.parse(content) as unknown
  return types.validate(j)
}
