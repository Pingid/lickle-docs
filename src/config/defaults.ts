import { is } from '@lickle/is'
import path from 'node:path'

import type { ProjectJson } from '../core/client.ts'
import type { UserConfig } from './types.ts'

import * as lib from '../_lib/index.ts'

/**
 * Resolve a partial `UserConfig` into a fully-defaulted `NewProjectConfig`.
 *
 * Missing fields fall back to `package.json`, conventional project files
 * (`README.md`) and the working directory. `declarations` / `children` stay
 * empty here — the reflection pass fills them once scanning is wired up.
 */
export const apply = async (dir: string, c?: UserConfig): Promise<ProjectJson> => {
  const pkg = await lib.pkg.read(process.cwd())
  const info = await lib.repo.info(dir)
  const readme = await lib.fs.existingPath(path.join(dir, 'README.md'))
  const defualtLinks = info ? [{ label: 'Repository', href: info.url }] : []
  const exports = c?.entrypoints ?? (await lib.pkg.resolveExportedSources(dir, pkg))

  const pages = await Promise.all(
    (c?.pages ?? (readme ? [{ label: 'README', content: readme }] : [])).map(async (x) => {
      const contents = is.string(x.content) ? [x.content] : x.content
      const content = await Promise.all(contents.map(async (c) => lib.fs.readFile(path.resolve(dir, c), 'utf-8')))
      return { label: x.label, content, slug: lib.slug.make(x.slug ?? x.label) }
    }),
  )

  return {
    name: c?.name ?? pkg?.name ?? err('No project name found'),
    version: c?.version ?? pkg?.version ?? info?.tag,
    pages,
    exports: exports,
    entrypoints: exports.map((e) => e.path),
    links: c?.links ?? defualtLinks,
    repo: info ? { url: info.url, rev: info.commit, fileUrl: info.fileUrl } : undefined,
    surface: [],
    declarations: [],
    children: [],
  }
}

const err = (msg: string): never => {
  throw new Error(msg)
}
