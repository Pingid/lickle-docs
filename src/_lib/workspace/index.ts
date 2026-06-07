import * as PackageJson from '../pkg/index.ts'
import * as Git from '../git/index.ts'

export interface RepoInfo {
  /** Clean browseable web URL, e.g. https://github.com/user/repo */
  url?: string
  rev?: string
  /** Web URL pinned to the resolved commit, if available. */
  fileUrl?: string
  tag?: string
}

/**
 * Resolve a project's repository URL.
 * Reads package.json `repository` (string or object, including monorepo
 * `directory`), falling back to the local git `origin` remote.
 */
export const info = async (projectDir: string): Promise<RepoInfo | null> => {
  const pk = await PackageJson.read(projectDir)
  if (!pk) return null

  const rp = PackageJson.repo(pk)
  const host = rp?.url ? await Git.host(rp.url) : null
  const rev = await Git.rev(projectDir).catch(() => undefined)
  const tag = await Git.tag(projectDir).catch(() => undefined)

  const b = host?.browse()

  const fileUrl =
    rev && b
      ? `${b}/blob/${rev}${rp?.directory ? '/' + rp.directory.replace(/^\/+/, '') : ''}{PATH}#L{LINE}`
      : undefined

  return { url: rp?.url?.replace(/^git\+/, '').replace(/\.git$/, ''), rev, fileUrl, tag }
}
