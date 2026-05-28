import { pathToFileURL } from 'node:url'
import { createJiti } from 'jiti'
import fs from 'node:fs/promises'
import fg from 'fast-glob'

import { type UserConfig } from './types.ts'

const EXT = ['ts', 'tsx', 'js', 'jsx', 'cjs', 'mjs', 'json']

export const load = async (dir: string): Promise<UserConfig | null> => {
  const file = await find(dir)
  console.log(file)
  if (!file) return null
  if (file.endsWith('.json')) return readJson(file)
  return readCode(file)
}

const find = async (dir: string): Promise<string | undefined> => {
  const ext = EXT.join(',')
  const files = await fg.glob(`lickle.{${ext}}`, { cwd: dir, absolute: true })
  return files?.[0]
}

const readCode = async (file: string): Promise<UserConfig> => {
  const jti = createJiti(pathToFileURL(import.meta.url).href, { moduleCache: false })
  const mod = await jti.import<{ default: any }>(file)
  const fl = await mod.default
  const c: UserConfig = {
    name: fl.name,
    version: fl.version,
    readme: fl.readme,
    pages: fl.pages,
    entrypoints: fl.entrypoints,
    links: fl.links,
    tsconfig: fl.tsconfig,
    packageJson: fl.packageJson,
    sourceLink: fl.sourceLink,
    workdir: fl.workdir,
  }
  return c
}

const readJson = async (file: string): Promise<UserConfig> => {
  const content = await fs.readFile(file, 'utf-8')
  const j = JSON.parse(content)
  const c: UserConfig = {
    name: j.value,
    version: j.value,
    readme: j.value,
    pages: j.pages,
    entrypoints: j.entrypoints,
    links: j.links,
    tsconfig: j.tsconfig,
    packageJson: j.packageJson,
    sourceLink: j.sourceLink,
    workdir: j.workdir,
  }
  return c
}
