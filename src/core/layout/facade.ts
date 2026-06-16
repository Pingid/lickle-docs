import type * as Reflect from '../reflect/index.ts'
import { memo } from '../../_lib/util/index.ts'
import type { t } from '../../_lib/index.ts'

/** A facade over a declaration that can expose members: a module or namespace. */
export type ModuleFacade = DeclarationFacade<'module' | 'namespace'>

export type DeclarationFacade<K extends keyof DeclarationFacadeMap = keyof DeclarationFacadeMap> =
  DeclarationFacadeMap[K]

export type DeclarationFacadeMap = {
  [K in keyof Reflect.DeclarationMap]: t.Compute<
    { id: Reflect.Id; name: string; kind: K; raw: Reflect.DeclarationMap[K] } & DeclarationFacadeApi
  >
}

export interface DeclarationFacadeApi {
  /** Get another declaration by id */
  get<K extends keyof Reflect.DeclarationMap = keyof Reflect.DeclarationMap>(
    id: Reflect.Id,
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
  /** Every comment tag of the declaration */
  tags: Map<string, Reflect.CommentTag>
}

export const createFacade = <K extends keyof Reflect.DeclarationMap = keyof Reflect.DeclarationMap>(
  index: Reflect.Index,
  id: Reflect.Id,
  alias?: string,
): DeclarationFacade<K> | undefined => {
  const declaration = index.get(id)
  if (!declaration) return undefined

  const fromExposures = (exposures: (Reflect.Exposure | undefined)[]) =>
    exposures
      .map((e) => (e ? createFacade<'module' | 'namespace'>(index, e.exposer, e.alias) : undefined))
      .filter(defined)

  const exposed: DeclarationFacade<any>['exposure'] = {
    is: () => index.exposures(id).length > 0 || index.isRoot(id),
    parents: () => fromExposures(index.exposedBy(id)),
    ancestors: () => index.exposures(id).map((x) => fromExposures(x)),
    children: () => fromExposures(index.exposes(id)),
    root: () => fromExposures(index.exposures(id).map((x) => x[0])) as DeclarationFacade<'module'>[],
  }

  const tags = memo(() => new Map(declaration.comment?.tags?.map((t) => [t.tag, t]) ?? []))

  const referenced = memo(() =>
    Array.from(index.referencedIn(id))
      .map((id) => createFacade(index, id))
      .filter((e) => e !== undefined),
  )

  return {
    raw: declaration as unknown as Reflect.Declaration<K>,
    kind: declaration.kind as K,
    id: declaration.id,
    name: declaration.name,
    get: (id: Reflect.Id) => createFacade(index, id),
    parent: () => createFacade<'module'>(index, declaration.parent),
    members: () =>
      Array.from(index.children(id))
        .map((d) => createFacade(index, d.id))
        .filter(defined),
    alias: () => alias ?? index.rootAlias(id)?.as,
    isEntry: (): this is DeclarationFacade<'module'> => index.isRoot(id),
    entryIndex: () => index.rootIndex(id),
    entry: () => index.rootAlias(id),
    referenced,
    get tags() {
      return tags()
    },
    exposure: exposed,
  } as DeclarationFacade<any>
}

const defined = <T>(x: T | undefined): x is T => x !== undefined
