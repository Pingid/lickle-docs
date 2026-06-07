import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import hostedGitInfo from 'hosted-git-info'

const exec = promisify(execFile)

export const host = async (url: string) => hostedGitInfo.fromUrl(url)

export const rev = async (dir: string, at: string = 'HEAD') => gitOut(dir, ['rev-parse', '--short', at])

export const tag = async (dir: string, at: string = 'HEAD') => gitOut(dir, ['describe', '--tags', at])

const gitOut = async (cwd: string, args: string[]) => exec('git', args, { cwd }).then(({ stdout }) => stdout.trim())
