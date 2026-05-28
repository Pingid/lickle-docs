import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { NewProjectConfig, UserConfig } from './types.ts'
import { pkgJson } from '../core/workspace/index.ts'
import { pagesFromExports } from './index.ts'

/**
 * Resolve a partial `UserConfig` into a fully-defaulted `NewProjectConfig`.
 *
 * Missing fields fall back to `package.json`, conventional project files
 * (`README.md`) and the working directory. `declarations` / `children` stay
 * empty here — the reflection pass fills them once scanning is wired up.
 */
export const determine = async (dir: string, c?: UserConfig): Promise<NewProjectConfig> => {
  const pkgPath = c?.packageJson ?? pkgJson.find(dir)
  const pkg = pkgPath ? await pkgJson.read(pkgPath).catch(() => undefined) : undefined

  const readme = await exists(path.join(dir, 'README.md'))

  return {
    name: c?.name ?? pkg?.name ?? err('No project name found'),
    version: c?.version ?? pkg?.version,
    pages: c?.pages ?? (readme ? [{ label: 'README', content: readme }] : []),
    entrypoints: c?.entrypoints ?? (await pagesFromExports({ packageJson: pkgPath })),
    links: c?.links ?? defaultLinks(pkg),
    sourceLink: c?.sourceLink ?? defaultSourceLink(dir, pkg),
    workdir: c?.workdir ?? dir,
    declarations: [],
    children: [],
  }
}

/** Single repository link when `package.json` declares one. */
const defaultLinks = (pkg: pkgJson.PackageJson | undefined): NewProjectConfig['links'] => {
  const repo = cleanRepoUrl(pkg?.repository?.url)
  return repo ? [{ label: 'Repository', href: repo }] : []
}

/**
 * Build a `{PATH}`/`{LINE}` source-link template from the repository URL and
 * the current git commit, e.g. `https://github.com/me/proj/blob/<sha>/{PATH}#L{LINE}`.
 * Returns `''` when there is no repository or git is unavailable.
 */
const defaultSourceLink = (dir: string, pkg: pkgJson.PackageJson | undefined): string => {
  const repo = cleanRepoUrl(pkg?.repository?.url)
  const hash = gitHash(dir)
  return repo && hash ? `${repo}/blob/${hash}/{PATH}#L{LINE}` : ''
}

/** Normalise an npm repository url: drop the `git+` prefix and `.git` suffix. */
const cleanRepoUrl = (url: string | undefined): string | undefined => url?.replace(/^git\+/, '').replace(/\.git$/, '')

const gitHash = (cwd: string): string | undefined => {
  try {
    return spawnSync('git', ['rev-parse', 'HEAD'], { cwd }).stdout.toString().trim() || undefined
  } catch {
    return undefined
  }
}

const err = (msg: string): never => {
  throw new Error(msg)
}

const exists = (p: string): Promise<string | undefined> =>
  fs
    .access(p)
    .then(() => p)
    .catch(() => undefined)
