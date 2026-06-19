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

export type Brand<B extends string, T> = T & { __brand: B; __type: T }
export const brand: {
  <B extends { __type: any }>(t: B['__type']): B
  <B extends string, T>(_: B, t: T): Brand<B, T>
} = ((x: any) => x) as any
