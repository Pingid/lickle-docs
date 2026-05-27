import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'

export const find = (_searchPath: string = process.cwd()): string | undefined => {
  return 'package.json'
}

export const read = async (configPath: string): Promise<PackageJson> => {
  const content = await fs.readFile(configPath, 'utf-8')
  return JSON.parse(content) as PackageJson
}

export type PackageJson = {
  name?: string
  version?: string
  description?: string
  author?: string
  repository?: { type: string; url: string }
  main?: string
  module?: string
  types?: string
  exports?: { [key: string]: { types?: string; import?: string; require?: string } }
}

// I am getting
// { name: '.', path: '/Users/dan/code/lickle-rx/lib/ts/index.d.ts' },
// { name: './*', path: '/Users/dan/code/lickle-rx/lib/ts/*.d.ts' }

// but i want all resolved exports

export const exports = async function* (dir: string, json: PackageJson) {
  const resolveExport = async function* (name: string, pth: string) {
    const relativePattern = pth.replace(/^\.\//, '')
    if (!relativePattern.includes('*')) yield { name, path: path.resolve(dir, relativePattern) }
    else {
      for await (const item of fg.globStream(relativePattern, { cwd: dir })) {
        const entry = item.toString()
        const subPath = entry.substring(relativePattern.indexOf('*'))
        const resolvedName = name.replace('*', subPath.replace(path.extname(subPath), ''))
        yield { name: resolvedName, path: entry }
      }
    }
  }

  for (const [name, path] of Object.entries(json.exports || {})) {
    const p = path.import ?? path.require ?? path.types
    if (!p) continue
    yield* resolveExport(name, p)
  }
}
