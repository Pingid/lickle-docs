import { execa } from 'execa'
import path from 'node:path'
import os from 'node:os'

import hostedGitInfo from 'hosted-git-info'

import * as Node from '../node/index.ts'

export const host = async (url: string) => hostedGitInfo.fromUrl(url)

export const rev = async (dir: string, at: string = 'HEAD') => gitOut(dir, ['rev-parse', '--short', at])

export const tag = async (dir: string, at: string = 'HEAD') => gitOut(dir, ['describe', '--tags', at])

const gitOut = async (cwd: string, args: string[]) => execa('git', args, { cwd }).then(({ stdout }) => stdout.trim())

export const worktrees = (opts?: { cwd?: string; treeDir?: string }) => {
  const treeDir = opts?.treeDir ?? os.tmpdir()
  const cwd = opts?.cwd ?? process.cwd()

  const runIn = async <T>(rev: string, f: (dir: string) => Promise<T>) => {
    const dir = path.resolve(treeDir, rev)
    await Node.Fs.ensureDir(dir)
    await execa('git', ['worktree', 'add', dir, rev], { cwd }).catch(() => void 0)
    try {
      return await f(dir)
    } finally {
      await execa('git', ['worktree', 'remove', dir], { cwd }).catch(() => void 0)
      await Node.Fs.rm(dir, { recursive: true }).catch(() => void 0)
    }
  }

  return { runIn }
}
