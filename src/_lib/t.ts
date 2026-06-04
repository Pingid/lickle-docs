export type MapKind<
  Map extends Record<string, any>,
  Key extends string = 'kind',
  Extra extends Record<string, any> = {},
> = {
  [K in keyof Map]: Compute<Map[K] & Extra & { [_K in Key]: K }>
}

export type MapKindUnion<
  Map extends Record<string, any>,
  Key extends string = 'kind',
  Extra extends Record<string, any> = {},
> = MapKind<Map, Key, Extra>[keyof Map]

export type Compute<T> = { [K in keyof T]: T[K] } & {}

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

export type DeepMerge<T, U> = T extends object
  ? U extends object
    ? {
        [K in keyof T | keyof U]: K extends keyof T
          ? K extends keyof U
            ? DeepMerge<T[K], U[K]>
            : T[K]
          : K extends keyof U
            ? U[K]
            : never
      }
    : U
  : U
