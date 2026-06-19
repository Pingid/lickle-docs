import type ts from 'typescript'
import path from 'node:path'
import mm from 'micromatch'
import fg from 'fast-glob'

import type { Config, UserConfig, ProjectVersion } from './types.ts'

import { Node, Pkg, Workspace, TsConfig, Slug } from '../../_lib/index.ts'

/**
 * Resolve a partial `UserConfig` into a fully-defaulted `UserConfig`.
 *
 * Missing fields fall back to `package.json`, conventional project files
 * (`README.md`) and the working directory.
 */
export const populate = async (
  dir: string,
  c?: Partial<UserConfig>,
): Promise<{ config: Config; ts: TsConfig.ResolvedTsconfig }> => {
  const pkg = await Pkg.read(process.cwd())
  const name = c?.name ?? pkg?.name
  if (!name) throw new Error('No project name found')

  const info = await Workspace.info(dir)
  const defualtLinks = info && info.url ? [{ label: 'Repository', href: info.url }] : []
  const entrypoints = c?.entrypoints ?? (await Pkg.resolveExportedSources(dir, pkg, { tsconfig: c?.tsconfig }))
  const absoluteEntrypoints = entrypoints.map((e) => ({ as: e.as, path: path.resolve(dir, e.path) }))
  const tsconfig = TsConfig.resolve(dir, c?.tsconfig)

  const include = wrapIncludeCheck(
    composeIncludeChecks(useConfigExcludeCheck(c), tsconfigIncludeCheck(tsconfig, dir), nodeModulesCheck),
    c?.include,
  )

  const pages = []

  if (c?.pages?.length) {
    for (const p of c?.pages) {
      if (p.content.endsWith('.md')) {
        const content = await Node.Fs.readFile(path.resolve(dir, p.content), 'utf-8')
        pages.push({ ...p, content })
      } else {
        pages.push({ ...p })
      }
    }
  } else {
    const readmePath = await Node.Fs.existingPath(path.resolve(dir, 'README.md'))
    if (readmePath) {
      const readme = await Node.Fs.readFile(readmePath, 'utf-8')
      if (readme) pages.push({ title: 'README', slug: '/', content: readme })
    }
  }

  const versions = c?.versions ? await fg.glob(path.resolve(dir, c.versions)) : []
  const resolvedVersions = await Promise.all(
    versions.map(async (v) => {
      const content = await Node.Fs.readFile(v, 'utf-8')
      const version = JSON.parse(content) as ProjectVersion
      if (!version.version) return null
      return { path: v, version: version.version, slug: Slug.normalize(Slug.toSlug(version.version)) }
    }),
  ).then((v) => v.filter((v) => v !== null))

  return {
    ts: tsconfig,
    config: {
      ...c,
      name,
      version: c?.version ?? pkg?.version ?? info?.tag,
      entrypoints: absoluteEntrypoints,
      links: c?.links ?? defualtLinks,
      repository: info && info.rev && info.url ? { url: info.url, rev: info.rev, fileUrl: info.fileUrl } : undefined,
      srcDir: c?.srcDir ?? tsconfig.rootDir,
      exclude: c?.exclude ?? [],
      pages,
      versions: resolvedVersions,
      include,
    } satisfies Config,
  }
}

type IncludeCheck = (sf: ts.SourceFile) => boolean

const wrapIncludeCheck =
  (base: IncludeCheck, check?: (sf: ts.SourceFile, defaultValue: boolean) => boolean): IncludeCheck =>
  (sf: ts.SourceFile) =>
    check ? check(sf, base(sf)) : base(sf)

const tsconfigIncludeCheck = (tsconfig: TsConfig.ResolvedTsconfig, dir: string): IncludeCheck => {
  const tsconfigDir = tsconfig.path ? path.dirname(tsconfig.path) : dir
  const tsconfigExclude = (tsconfig.config.exclude ?? []).map((i) => path.resolve(tsconfigDir, i))
  const tsconfigInclude = (tsconfig.config.include ?? []).map((i) => path.resolve(tsconfigDir, i))
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
  (sf: ts.SourceFile) => {
    for (const check of checks) {
      if (!check(sf)) return false
    }
    return true
  }
