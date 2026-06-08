import path from 'node:path'
import { execa } from 'execa'

import type { ProjectJson } from '../core/config/types.ts'
import { Config, buildDocs } from '../core/index.ts'
import { Git, Cache } from '../_lib/index.ts'

export const versions = async (p: { tags: string[]; prepare?: string }) => {
  const cwd = process.cwd()
  const cache = Cache.file<ProjectJson>({ dir: path.join(cwd, 'node_modules', '.lickle') })
  const runner = Git.worktrees()

  const versions: ProjectJson[] = []
  for (const tag of p.tags) {
    const rev = await Git.rev(cwd, tag)
    const v = await cache.getOrUpdate(rev, () => runner.runIn(rev, (dir) => build({ dir, prepare: p.prepare })))
    versions.push(v)
  }

  return versions
}

const build = async (p: { dir: string; prepare?: string }) => {
  if (p.prepare) await execa(p.prepare, { cwd: p.dir, stdio: 'inherit' })
  const load = await Config.load(p.dir)
  const routes = await buildDocs(p.dir, load.config, load.ts)
  const json: Config.ProjectJson = {
    name: load.config.name,
    version: load.config.version,
    repository: load.config.repository,
    links: load.config.links,
    entrypoints: load.config.entrypoints,
    routes,
  }
  return json
}
