import fs from 'node:fs/promises'

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
  exports?: { [key: string]: { types?: string; import?: string; require?: string } }
}
