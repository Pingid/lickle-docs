// type Base = { id: number; name: string; parent: number; sources: Source[] }
// type Source = { file: string; line: number; column: number }

// export interface DecsMap {
//   // Top level declarations
//   variable: { type: Type; defaultValue?: string }
//   function: { signatures: Part<'signature'>[] }
//   class: {}
//   interface: {}
//   alias: {}
//   enum: {}
//   namespace: {}
//   exports: { names: { name: string; id: number }[] }
//   module: { path: string }
// }

// export interface TypesMapMap {
//   intrinsic: {}
//   literal: {}
//   reference: {}
//   union: {}
//   intersection: {}
//   array: {}
//   tuple: {}
// }

// export interface PartsMap {
//   signature: { generics: Part<'generic'>[]; params: Part<'parameter'>[]; return: Type }
//   parameter: {}
//   generic: {}
// }

// // ---------------- TITLE ----------------
// type Declaration<K extends keyof DeclarationMap = keyof DeclarationMap> = DeclarationMap[K]
// type Type<K extends keyof TypeMap = keyof TypeMap> = TypeMap[K]
// type Part<K extends keyof PartMap = keyof PartMap> = PartMap[K]
// type Any<K extends keyof AnyMap = keyof AnyMap> = AnyMap[K]

// // ---------------- Remapped with kind and base ----------------
// type DeclarationMap = WithKind<DecsMap, Base & { exported: boolean }>
// type TypeMap = WithKind<TypesMapMap, Base>
// type PartMap = WithKind<PartsMap, Base>
// type AnyMap = DeclarationMap & TypeMap & PartMap

// // ---------------- Utilities ----------------
// type WithKind<T extends Record<string, any>, E extends Record<string, any> = {}> = {
//   [K in keyof T]: Compute<T[K] & E & { kind: K }>
// }
// type Compute<T> = { [K in keyof T]: T[K] } & {}
