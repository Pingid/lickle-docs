import { execFile, spawn as spawnRaw } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { promisify } from 'node:util'

export * as Jiti from './jiti.ts'
export * as Fs from './fs.ts'

export const exec = promisify(execFile)
export const spawn = promisify(spawnRaw)

export const onExit = (fn: () => any) => {
  const cleanup = async () => {
    await fn()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

export const hash = (str: string) => createHash('sha256').update(str).digest('hex')

export const id = () => randomUUID()
