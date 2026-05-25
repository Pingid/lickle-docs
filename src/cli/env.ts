import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const libRoot = fileURLToPath(new URL('../../', import.meta.url))

export const getRootPath = (pth?: string) => (pth ? path.resolve(libRoot, pth) : libRoot)
