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
