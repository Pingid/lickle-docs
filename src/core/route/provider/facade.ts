import type { Reflect } from '../../index.ts'

export type DeclarationFacade<K extends keyof Reflect.DeclarationMap = keyof Reflect.DeclarationMap> =
  Reflect.Declaration<K> & {
    srcFile: string
    /** Whether the declaration is an entrypoint module. */
    isEntry(): this is DeclarationFacade<'module'>
    /** Whether the declaration is exposed to the public API. */
    isExposed(): boolean
  }

export const createFacade = (index: Reflect.Index, id: number): DeclarationFacade => {
  const declaration = index.get(id)
  if (!declaration) throw new Error(`Declaration with id ${id} not found`)
  return {
    ...declaration,
    get srcFile() {
      return declaration.sources[0]?.file ?? ''
    },
    isEntry: (): this is DeclarationFacade<'module'> => index.isRoot(id),
    isExposed: (): boolean => index.isExposed(id),
  }
}
