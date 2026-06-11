import type { t } from '../../../_lib/index.ts'
import type { Reflect } from '../../index.ts'
import type { Exposure } from '../../reflect/indexed.ts'

/**
 * The declaration view adapter hooks receive: the raw declaration plus
 * index-aware helpers for the questions hooks usually ask — where it came
 * from, whether it is an entrypoint, whether it is public.
 */
export type DeclarationFacade<K extends keyof Reflect.DeclarationMap = keyof Reflect.DeclarationMap> =
  DeclarationFacadeMap[K]
type DeclarationFacadeMap = t.MapKind<Reflect.DeclarationDefinitions, 'kind', Reflect.Base & DeclarationFacadeApi>
/** A facade over a declaration that can expose members: a module or namespace. */
export type ModuleFacade = DeclarationFacade<'module'> | DeclarationFacade<'namespace'>

export interface DeclarationFacadeApi {
  /** Get another declaration by id */
  get<K extends keyof Reflect.DeclarationMap = keyof Reflect.DeclarationMap>(
    id: number,
  ): DeclarationFacade<K> | undefined
  /** Parent module where the declaration is defined */
  parent(): DeclarationFacade<'module'> | undefined
  /** Declarations that are defined in this module */
  members(): DeclarationFacade[]
  /** Alias of the declaration, either re-export eg export { Foo as Bar}  or entrypoint import path from package json when isEntry is true*/
  alias(): string | undefined
  /** Whether the declaration is an entrypoint module. */
  isEntry(): boolean
  /** The index of the module in the entrypoints. */
  entryIndex(): number | undefined
  /** Entrypoint label and position from the config, when the declaration is an entrypoint module. */
  entry(): { as: string; index: number } | undefined
  /** Declarations that reference this declaration */
  referenced: () => Iterable<DeclarationFacade>
  /** Information about the declaration's exposure through export or re-export */
  exposure: {
    /** Whether the declaration is exposed to the public API. */
    is(): boolean
    /** Direct parent modules where this declaration is exposed */
    parents(): ModuleFacade[]
    /**
     * Every re-export chain from an entrypoint to this declaration: each
     * element is an exposing module, carrying the alias of the next hop.
     * The first element is the entrypoint, the last is the direct parent.
     */
    ancestors(): ModuleFacade[][]
    /** Children modules that this declaration exposes */
    children(): DeclarationFacade[]
    /** Root modules where this declaration is exposed */
    root(): DeclarationFacade<'module'>[]
  }
}

export const createFacade = <K extends keyof Reflect.DeclarationMap = keyof Reflect.DeclarationMap>(
  index: Reflect.Index,
  id: number,
  alias?: string,
): DeclarationFacade<K> | undefined => {
  const declaration = index.get(id)
  if (!declaration) return undefined

  const fromExposures = (exposures: (Exposure | undefined)[]) =>
    exposures
      .map((e) => (e ? createFacade<'module' | 'namespace'>(index, e.exposer, e.alias) : undefined))
      .filter(defined)

  const exposed: DeclarationFacade<any>['exposure'] = {
    is: () => index.isExposed(id),
    parents: () => fromExposures(index.exposedBy(id)),
    ancestors: () => index.exposures(id).map((x) => fromExposures(x)),
    children: () => fromExposures(index.exposes(id)),
    root: () => fromExposures(index.exposures(id).map((x) => x[0])) as DeclarationFacade<'module'>[],
  }

  return {
    ...(declaration as Reflect.Declaration<K>),
    get: (id) => createFacade(index, id),
    parent: () => createFacade<'module'>(index, declaration.parent),
    members: () =>
      Array.from(index.children(id))
        .map((d) => createFacade(index, d.id))
        .filter(defined),
    alias: () => alias ?? index.rootAlias(id)?.as,
    isEntry: (): this is DeclarationFacade<'module'> => index.isRoot(id),
    entryIndex: () => index.rootIndex(id),
    entry: () => index.rootAlias(id),
    referenced: () =>
      Array.from(index.referencedIn(id))
        .map((id) => createFacade(index, id))
        .filter((e) => e !== undefined),
    exposure: exposed,
  }
}

const defined = <T>(x: T | undefined): x is T => x !== undefined
