import fs from 'node:fs/promises'
import path from 'node:path'

export * from 'node:fs/promises'

export const existingPath = async (path: string) => exists(path).then((exists) => (exists ? path : undefined))

export const exists = async (path: string): Promise<boolean> => {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

export const ensureDir = async (pth: string) => {
  // Get the parent dir if its a file otherwise use path
  const dir = path.extname(pth) ? path.dirname(pth) : pth
  await fs.mkdir(dir, { recursive: true })
}
