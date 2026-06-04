import fs from 'node:fs/promises'
import path from 'node:path'

export * from 'node:fs/promises'

export * from './watch.ts'

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

export const sanitizeFilename = (str: string) => {
  return (
    str
      // Remove illegal characters for Windows/Mac/Linux
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      // Remove relative path modifiers
      .replace(/^\.+/g, '')
      // Optional: Replace spaces with underscores or dashes for web-friendliness
      .replace(/\s+/g, '-')
      // Prevent trailing spaces or periods (invalid in Windows)
      .trim()
      .replace(/[\s.]+$/, '')
  )
}
