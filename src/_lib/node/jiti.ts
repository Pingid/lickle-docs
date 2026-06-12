import { pathToFileURL } from 'node:url'
import { createJiti } from 'jiti'

const jiti = createJiti(pathToFileURL(import.meta.url).href, {
  moduleCache: false,
  fsCache: false,
  virtualModules: {},
  jsx: true,
})

export const importModule = async <T>(file: string): Promise<T> => jiti.import<T>(file)
