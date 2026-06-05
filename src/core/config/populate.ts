import type ts from 'typescript'
import path from 'node:path'
import mm from 'micromatch'

import type { Config, UserConfig } from './types.ts'

import { Node, Path, Pkg, Repo, TsConfig } from '../../_lib/index.ts'

/**
 * Resolve a partial `UserConfig` into a fully-defaulted `UserConfig`.
 *
 * Missing fields fall back to `package.json`, conventional project files
 * (`README.md`) and the working directory.
 */
export const populate = async (dir: string, c?: Partial<UserConfig>) => {
  const pkg = await Pkg.read(process.cwd())
  const name = c?.name ?? pkg?.name
  if (!name) throw new Error('No project name found')

  const info = await Repo.info(dir)
  const defualtLinks = info ? [{ label: 'Repository', href: info.url }] : []
  const entrypoints = c?.entrypoints ?? (await Pkg.resolveExportedSources(dir, pkg, { tsconfig: c?.tsconfig }))
  const absoluteEntrypoints = entrypoints.map((e) => ({ as: e.as, path: path.resolve(dir, e.path) }))
  const tsconfig = TsConfig.resolve(dir, c?.tsconfig)

  const include = wrapIncludeCheck(
    composeIncludeChecks(useConfigExcludeCheck(c), tsconfigIncludeCheck(tsconfig, dir), nodeModulesCheck),
    c?.include,
  )
  const routes: Config['routes'] = []

  const readmePath = await Node.Fs.existingPath(path.resolve(dir, 'README.md'))
  if (!c?.pages && readmePath) {
    const readme = await Node.Fs.readFile(readmePath, 'utf-8')
    if (readme) {
      routes.push({
        title: 'README',
        slug: '/',
        sidebar: {},
        body: [{ kind: 'markdown', markdown: readme }],
      })
    }
  }

  if (c?.pages?.length) {
    for (const p of c.pages) {
      const content = await Node.Fs.readFile(path.resolve(dir, p.content), 'utf-8')
      routes.push({
        title: p.title,
        slug: p.slug ?? Path.toSlug(p.title),
        sidebar: {},
        body: [{ kind: 'markdown', markdown: content }],
      })
    }
  }

  return {
    config: {
      ...c,
      name,
      version: c?.version ?? pkg?.version ?? info?.tag,
      entrypoints: absoluteEntrypoints,
      links: c?.links ?? defualtLinks,
      repository: info ? { url: info.url, rev: info.commit, fileUrl: info.fileUrl } : undefined,
      srcDir: c?.srcDir ?? tsconfig.rootDir,
      exclude: c?.exclude ?? [],
      include,
      routes,
    } satisfies Config,
  }
}

type IncludeCheck = (sf: ts.SourceFile) => boolean

const wrapIncludeCheck =
  (base: IncludeCheck, check?: (sf: ts.SourceFile, defaultValue?: boolean) => boolean): IncludeCheck =>
  (sf: ts.SourceFile) =>
    check ? check(sf, base(sf)) : base(sf)

const tsconfigIncludeCheck = (tsconfig: TsConfig.ResolvedTsconfig, dir: string): IncludeCheck => {
  const tsconfigDir = tsconfig.config?.path ? path.dirname(tsconfig.config.path) : dir
  const tsconfigExclude = (tsconfig.config?.config.exclude ?? []).map((i) => path.resolve(tsconfigDir, i))
  const tsconfigInclude = (tsconfig.config?.config.include ?? []).map((i) => path.resolve(tsconfigDir, i))
  return (sf: ts.SourceFile) => {
    const pth = sf.fileName
    if (tsconfigInclude.length && !tsconfigInclude.some((i) => mm.isMatch(pth, i))) return false
    if (tsconfigExclude.some((i) => mm.isMatch(pth, i))) return false
    return true
  }
}

const useConfigExcludeCheck = (config?: { exclude?: string[] }): IncludeCheck => {
  return (sf: ts.SourceFile) => {
    const pth = sf.fileName
    if (config?.exclude?.some((i) => mm.isMatch(pth, i))) return false
    return true
  }
}

const nodeModulesCheck: IncludeCheck = (sf: ts.SourceFile) => !sf.fileName.includes('/node_modules/')

const composeIncludeChecks =
  (...checks: IncludeCheck[]): IncludeCheck =>
  (sf: ts.SourceFile) =>
    checks.every((check) => check(sf))
