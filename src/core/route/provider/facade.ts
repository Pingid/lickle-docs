import type { Reflect } from '../../index.ts'

/**
 * The declaration view adapter hooks receive: the raw declaration plus
 * index-aware helpers for the questions hooks usually ask — where it came
 * from, whether it is an entrypoint, whether it is public.
 */
export type DeclarationFacade<K extends keyof Reflect.DeclarationMap = keyof Reflect.DeclarationMap> =
  Reflect.Declaration<K> & {
    /** Source file of the declaration, relative to the project root. */
    srcFile: string
    /** Whether the declaration is an entrypoint module. */
    isEntry(): this is DeclarationFacade<'module'>
    /** The index of the module in the entrypoints. */
    entryIndex(): number | undefined
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
    entryIndex: (): number | undefined => index.rootIndex(id),
    isExposed: (): boolean => index.isExposed(id),
  }
}
