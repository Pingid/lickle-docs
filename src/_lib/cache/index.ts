import path from 'node:path'

import { Node } from '../index.ts'

export const file = <T>(p: { dir: string }) => {
  const getOrUpdate = async (key: string, f: () => Promise<T>) => {
    const pth = path.join(p.dir, `${key}.json`)
    try {
      if (await Node.Fs.exists(pth)) {
        return JSON.parse(await Node.Fs.readFile(pth, 'utf-8')).data as T
      }
    } catch {
      // ignore parse errors and fall through to update
    }
    const value = await f()
    await Node.Fs.ensureDir(p.dir)
    await Node.Fs.writeFile(pth, JSON.stringify({ data: value }))
    return value
  }
  return { getOrUpdate }
}
