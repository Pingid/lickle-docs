import { execa } from 'execa'
import path from 'node:path'

import type { ProjectJson } from '../core/config/types.ts'
import { Config, Build } from '../core/index.ts'
import { Git, Cache } from '../_lib/index.ts'

export const versions = async (p: { tags: string[]; prepare?: string }) => {
  const cwd = process.cwd()
  const cache = Cache.file<ProjectJson>({ dir: path.resolve('node_modules', '.lickle') })
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
  if (p.prepare) await execa({ cwd: p.dir, stdio: 'inherit', shell: true })`${p.prepare}`
  const load = await Config.load(p.dir)
  return Build.fromConfig(p.dir, load.config, load.ts)
}
