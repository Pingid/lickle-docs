import { pathToFileURL } from 'node:url'
import { createJiti } from 'jiti'

// const jti = createJiti(pathToFileURL(import.meta.url).href, {
//     moduleCache: false,
//     cache: false,
//   })
//   const mod = await jti.import<{ default: any }>(file)
//   const fl = await mod.default
//   return valid(fl)

const jiti = createJiti(pathToFileURL(import.meta.url).href, {
  moduleCache: false,
  virtualModules: {},
  jsx: true,
})

export const importModule = async <T>(file: string): Promise<T> => jiti.import<T>(file)
