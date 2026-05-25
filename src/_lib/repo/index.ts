import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import hostedGitInfo from 'hosted-git-info'
import * as pkg from '../pkg/index.ts'

const exec = promisify(execFile)

export interface RepoInfo {
  /** Clean browseable web URL, e.g. https://github.com/user/repo */
  url: string
  /** Web URL pointing at the package's subdirectory, if `directory` is set. */
  directoryUrl?: string
  /** Normalized git clone URL, e.g. git+https://github.com/user/repo.git */
  git: string
  /** Host shortcut, e.g. github:user/repo */
  shortcut: string
  host: string // "github.com", "gitlab.com", ...
  user: string
  project: string
  /** Short commit hash of HEAD, if inside a git work tree. */
  commit?: string
  /** Nearest tag describing HEAD (e.g. "v1.2.0" or "v1.2.0-3-gabc123"). */
  tag?: string
  /** Web URL pinned to the resolved commit, if available. */
  commitUrl?: string
  /** Web URL pinned to the resolved commit, if available. */
  fileUrl?: string
  /** Where the URL came from. */
  source: 'package.json' | 'git'
}

/**
 * Resolve a project's repository URL.
 * Reads package.json `repository` (string or object, including monorepo
 * `directory`), falling back to the local git `origin` remote.
 */
export const info = async (projectDir: string): Promise<RepoInfo | null> => {
  const rev = await getGitRevision(projectDir)
  const fromPkg = await fromPackageJson(projectDir, rev)
  if (fromPkg) return fromPkg
  return fromGit(projectDir, rev)
}

type GitRevision = { commit?: string; tag?: string }

async function getGitRevision(projectDir: string): Promise<GitRevision> {
  const commit = await gitOut(projectDir, ['rev-parse', '--short', 'HEAD'])
  const described = await gitOut(projectDir, ['describe', '--tags', '--always'])
  const tag = described && described !== commit ? described : undefined
  return { commit: commit || undefined, tag }
}

async function gitOut(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await exec('git', args, { cwd })
    return stdout.trim()
  } catch {
    return null
  }
}

async function fromPackageJson(projectDir: string, rev: GitRevision): Promise<RepoInfo | null> {
  let pk: pkg.PackageJson
  try {
    pk = await pkg.read(projectDir)
  } catch {
    return null
  }

  const repo = pk.repository
  if (repo == null) return null

  const rawUrl = typeof repo === 'string' ? repo : repo.url
  const directory = typeof repo === 'object' ? repo.directory : undefined
  if (typeof rawUrl !== 'string') return null

  const info = hostedGitInfo.fromUrl(rawUrl)
  if (!info) {
    // Unrecognized host: return the raw url, best-effort.
    return {
      url: rawUrl.replace(/^git\+/, '').replace(/\.git$/, ''),
      git: rawUrl,
      shortcut: rawUrl,
      host: '',
      user: '',
      project: '',
      commit: rev.commit,
      tag: rev.tag,
      source: 'package.json',
    }
  }

  return build(info, directory, rev, 'package.json')
}

async function fromGit(projectDir: string, rev: GitRevision): Promise<RepoInfo | null> {
  const origin = await gitOut(projectDir, ['config', '--get', 'remote.origin.url'])
  if (!origin) return null

  const info = hostedGitInfo.fromUrl(origin)
  if (!info) return null
  return build(info, undefined, rev, 'git')
}

function build(
  info: hostedGitInfo,
  directory: string | undefined,
  rev: GitRevision,
  source: RepoInfo['source'],
): RepoInfo {
  const url = info.browse()
  // Pin to the commit: `${repo}/tree/${commit}[/${directory}]`. This layout is
  // shared by GitHub, GitLab, and Bitbucket; browse()'s committish arg is only
  // a URL fragment in this version, so we construct it explicitly.
  const commitUrl = rev.commit
    ? `${url}/tree/${rev.commit}${directory ? '/' + directory.replace(/^\/+/, '') : ''}`
    : undefined

  const fileUrl = rev.commit
    ? `${url}/blob/${rev.commit}${directory ? '/' + directory.replace(/^\/+/, '') : ''}{PATH}#L{LINE}`
    : undefined

  return {
    url,
    directoryUrl: directory ? info.browse(directory) : undefined,
    git: info.https(),
    shortcut: info.shortcut(),
    host: info.domain,
    user: info.user,
    project: info.project,
    commit: rev.commit,
    tag: rev.tag,
    commitUrl,
    fileUrl,
    source,
  }
}
