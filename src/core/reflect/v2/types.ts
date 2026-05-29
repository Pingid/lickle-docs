export interface DeclarationMap {
  variable: {}
  function: {}
  class: {}
  interface: {}
  alias: {}
  enum: {}
  namespace: {}
  exports: { names: { name: string; id: number }[] }
  module: { path: string }
}

export interface TypeMap {
  intrinsic: {}
  literal: {}
  reference: {}
  union: {}
  intersection: {}
  array: {}
  tuple: {}
  'function-type': {}
  'type-operator': {}
}

export interface Base {
  id: number
  name: string
  parent: number
  sources: Source[]
}

export interface Source {
  file: string
  line: number
  column: number
}

export interface DeclarationBase extends Base {
  exported: boolean
}

export type DeclarationKinds = { [K in keyof DeclarationMap]: DeclarationMap[K] & DeclarationBase & { kind: K } }
export type Declaration<K extends keyof DeclarationKinds = keyof DeclarationKinds> = Compute<DeclarationKinds[K]>

export type TypeKinds = { [K in keyof TypeMap]: TypeMap[K] & Base & { kind: K } }
export type Type<K extends keyof TypeKinds = keyof TypeKinds> = Compute<TypeKinds[K]>

type Compute<T> = { [K in keyof T]: T[K] } & {}

export type IntrinsicName =
  | 'string'
  | 'number'
  | 'boolean'
  | 'bigint'
  | 'symbol'
  | 'void'
  | 'undefined'
  | 'null'
  | 'never'
  | 'any'
  | 'unknown'
  | 'object'
