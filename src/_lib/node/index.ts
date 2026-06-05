import { createHash } from 'node:crypto'

export * as Jiti from './jiti.ts'
export * as Fs from './fs.ts'

export const onExit = (fn: () => any) => {
  const cleanup = async () => {
    await fn()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

export const hash = (str: string) => createHash('sha256').update(str).digest('hex')
