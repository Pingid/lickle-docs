import * as resolve from './resolve.ts'
import * as scan from './scan.ts'
import * as T from './types.ts'

export type * from './resolve.ts'

export const build = (projectName: string, files: string[], options: scan.Options): resolve.Project =>
  resolve.project(scan.project(files, projectName, options))

export type Registry = resolve.Registry
export type DeclarationMap = resolve.DeclarationMap
export type TypeMap = resolve.TypeMap
export type Project = T.Project<Registry>
export type Source = T.Source
export type Flags = T.Flags
export type Module = T.Module<Registry>
export type ReExport = T.ReExport
export type NamedExport = T.NamedExport
export type Variable = T.Variable<Registry>
export type Func = T.Func<Registry>
export type Class = T.Class<Registry>
export type Interface = T.Interface<Registry>
export type TypeAlias = T.TypeAlias<Registry>
export type Enum = T.Enum
export type EnumMember = T.EnumMember
export type Property = T.Property<Registry>
export type Method = T.Method<Registry>
export type IndexSignature = T.IndexSignature<Registry>
export type Signature = T.Signature<Registry>
export type Parameter = T.Parameter<Registry>
export type TypeParameter = T.TypeParameter<Registry>
export type IntrinsicType = T.IntrinsicType
export type LiteralType = T.LiteralType
export type ReferenceType = T.ReferenceType<Registry>
export type UnresolvedType = T.UnresolvedType<Registry>
export type UnionType = T.UnionType<Registry>
export type IntersectionType = T.IntersectionType<Registry>
export type ArrayType = T.ArrayType<Registry>
export type TupleType = T.TupleType<Registry>
export type TupleElement = T.TupleElement<Registry>
export type FunctionType = T.FunctionType<Registry>
export type TypeOperatorType = T.TypeOperatorType<Registry>
export type QueryType = T.QueryType<Registry>
export type ReflectionType = T.ReflectionType<Registry>
export type ObjectLiteral = T.ObjectLiteral<Registry>
export type Comment = T.Comment
