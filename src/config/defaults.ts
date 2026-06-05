import path from 'node:path'

import type { UserConfig } from './types.ts'

import { Node, Pkg, Repo, TsConfig } from '../_lib/index.ts'

/**
 * Resolve a partial `UserConfig` into a fully-defaulted `NewProjectConfig`.
 *
 * Missing fields fall back to `package.json`, conventional project files
 * (`README.md`) and the working directory. `declarations` / `children` stay
 * empty here — the reflection pass fills them once scanning is wired up.
 */
export const apply = async (dir: string, c?: Partial<UserConfig>): Promise<UserConfig> => {
  const pkg = await Pkg.read(process.cwd())
  const info = await Repo.info(dir)
  const readme = await Node.Fs.existingPath(path.join(dir, 'README.md'))
  const defualtLinks = info ? [{ label: 'Repository', href: info.url }] : []
  const entrypoints = c?.entrypoints ?? (await Pkg.resolveExportedSources(dir, pkg))
  const tsconfig = TsConfig.resolve(dir)

  const name = c?.name ?? pkg?.name
  if (!name) throw new Error('No project name found')

  return {
    ...c,
    name,
    version: c?.version ?? pkg?.version ?? info?.tag,
    pages: c?.pages ?? (readme ? [{ title: 'README', slug: '', content: readme }] : undefined),
    entrypoints,
    links: c?.links ?? defualtLinks,
    repository: info ? { url: info.url, rev: info.commit, fileUrl: info.fileUrl } : undefined,
    srcDir: c?.srcDir ?? tsconfig.rootDir,
    full: c?.full,
  }
}
