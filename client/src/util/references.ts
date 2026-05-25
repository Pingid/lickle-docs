import type { JSONOutput } from 'typedoc'
import { Kind } from './kind.js'

type Decl = JSONOutput.DeclarationReflection
type Sig = JSONOutput.SignatureReflection
type Proj = JSONOutput.ProjectReflection
type SomeType = JSONOutput.SomeType

export type ReferenceKind = 'extends' | 'implements' | 'typeParam' | 'param' | 'returns' | 'type' | 'property'

export type Reference = { referrer: number; kinds: Set<ReferenceKind> }

/**
 * Invert the typedoc tree into `target id -> Reference[]`.
 *
 * Walks every type-bearing slot on every declaration / signature, records each
 * `ReferenceType.target`, and bubbles the referrer up to its nearest routable
 * ancestor so the resulting list always links to a real page.
 */
export const buildReferences = (
  project: Proj,
  parents: Map<number, number>,
  isRoutable: (id: number) => boolean,
): Map<number, Reference[]> => {
  const out = new Map<number, Reference[]>()

  /** Climb `parents` until we hit a routable reflection; `null` when none in the chain. */
  const routableAncestor = (id: number | undefined): number | null => {
    let cur = id
    while (cur != null) {
      if (isRoutable(cur)) return cur
      cur = parents.get(cur)
    }
    return null
  }

  const emit = (target: number, ownerId: number, kind: ReferenceKind) => {
    const referrer = routableAncestor(ownerId)
    if (referrer == null || referrer === target) return
    let arr = out.get(target)
    if (!arr) out.set(target, (arr = []))
    const existing = arr.find((r) => r.referrer === referrer)
    if (existing) existing.kinds.add(kind)
    else arr.push({ referrer, kinds: new Set([kind]) })
  }

  const walkType = (t: SomeType | undefined, ownerId: number, kind: ReferenceKind): void => {
    if (!t) return
    switch (t.type) {
      case 'reference': {
        const target = (t as JSONOutput.ReferenceType & { target?: number | object }).target
        if (typeof target === 'number') emit(target, ownerId, kind)
        const args = (t as JSONOutput.ReferenceType).typeArguments
        if (args) for (const a of args) walkType(a as SomeType, ownerId, kind)
        return
      }
      case 'array':
        return walkType(t.elementType as SomeType, ownerId, kind)
      case 'tuple':
        for (const e of t.elements ?? []) walkType(e as SomeType, ownerId, kind)
        return
      case 'union':
      case 'intersection':
        for (const u of t.types as SomeType[]) walkType(u, ownerId, kind)
        return
      case 'reflection':
        return walkDecl(t.declaration, ownerId, kind)
      case 'typeOperator':
        return walkType(t.target as SomeType, ownerId, kind)
      case 'query':
        return walkType(t.queryType as SomeType, ownerId, kind)
      case 'indexedAccess':
        walkType(t.objectType as SomeType, ownerId, kind)
        walkType(t.indexType as SomeType, ownerId, kind)
        return
      case 'conditional':
        walkType(t.checkType as SomeType, ownerId, kind)
        walkType(t.extendsType as SomeType, ownerId, kind)
        walkType(t.trueType as SomeType, ownerId, kind)
        walkType(t.falseType as SomeType, ownerId, kind)
        return
      case 'templateLiteral': {
        const tail = (t as JSONOutput.TemplateLiteralType).tail ?? []
        for (const seg of tail) walkType(seg[0] as SomeType, ownerId, kind)
        return
      }
      case 'mapped': {
        const m = t as JSONOutput.MappedType
        walkType(m.parameterType as SomeType, ownerId, kind)
        walkType(m.templateType as SomeType, ownerId, kind)
        return
      }
      case 'rest':
        return walkType((t as JSONOutput.RestType).elementType as SomeType, ownerId, kind)
      case 'optional':
        return walkType((t as JSONOutput.OptionalType).elementType as SomeType, ownerId, kind)
      case 'namedTupleMember':
        return walkType((t as JSONOutput.NamedTupleMemberType).element as SomeType, ownerId, kind)
      case 'predicate':
        return walkType(t.targetType as SomeType, ownerId, kind)
      // Leaves with no nested types: intrinsic, literal, unknown.
      default:
        return
    }
  }

  const walkTypeParams = (tps: JSONOutput.TypeParameterReflection[] | undefined, ownerId: number): void => {
    if (!tps) return
    for (const tp of tps) {
      walkType(tp.type as SomeType | undefined, ownerId, 'typeParam')
      walkType((tp as { default?: SomeType }).default, ownerId, 'typeParam')
    }
  }

  const walkSignature = (sig: Sig, ownerId: number): void => {
    walkType(sig.type as SomeType | undefined, ownerId, 'returns')
    for (const p of sig.parameters ?? []) walkType(p.type as SomeType | undefined, ownerId, 'param')
    walkTypeParams(sig.typeParameters, ownerId)
  }

  /** `parentKind` keeps `decl.type` -> 'property' for class/interface children. */
  const walkDecl = (decl: Decl, ownerId: number, declType: ReferenceKind = 'type'): void => {
    const id = decl.id ?? ownerId
    for (const t of decl.extendedTypes ?? []) walkType(t as SomeType, id, 'extends')
    for (const t of decl.implementedTypes ?? []) walkType(t as SomeType, id, 'implements')
    walkTypeParams(decl.typeParameters, id)
    if (decl.type) walkType(decl.type as SomeType, id, declType)
    for (const s of decl.signatures ?? []) walkSignature(s, id)
    for (const s of decl.indexSignatures ?? []) walkSignature(s, id)
    if (decl.getSignature) walkSignature(decl.getSignature, id)
    if (decl.setSignature) walkSignature(decl.setSignature, id)
    for (const c of decl.children ?? []) {
      const childKind = c.kind === Kind.Property ? 'property' : 'type'
      walkDecl(c, id, childKind)
    }
  }

  for (const child of project.children ?? []) walkDecl(child, project.id, 'type')

  return out
}
