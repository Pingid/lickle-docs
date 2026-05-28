import type * as resolve from '../reflect/resolve.ts'

export type Kind = 'module' | 'namespace' | 'variable' | 'function' | 'class' | 'interface' | 'type-alias' | 'enum'

export interface SurfaceItem {
  id: number
  kind: Kind
  /** Override label — set when an `Exports` clause exposes the target under a different name. */
  name?: string
}

export interface SurfaceEntry {
  /** Relative source path of the entrypoint module. */
  entrypoint: string
  /** Routable items the entrypoint exposes, in source order. */
  items: SurfaceItem[]
}

/**
 * Public surface for each entrypoint — the routable items reachable from the
 * entrypoint module. `Exports` clauses are expanded inline: each `names[]`
 * entry becomes a surface item using the alias as `name`. `Namespace` decls
 * are emitted as-is (they own their own children and have their own page).
 */
export const compute = (entrypoints: string[], declarations: resolve.Declaration[], topIds: number[]): SurfaceEntry[] => {
  const byId = new Map<number, resolve.Declaration>(declarations.map((d) => [d.id, d]))
  const moduleByPath = new Map<string, resolve.Module>()
  for (const id of topIds) {
    const mod = byId.get(id)
    if (mod && mod.kind === 'module' && mod.path) moduleByPath.set(mod.path, mod)
  }

  const out: SurfaceEntry[] = []
  for (const entrypoint of entrypoints) {
    const mod = moduleByPath.get(entrypoint)
    if (!mod) continue
    const items: SurfaceItem[] = []
    const seen = new Set<number>()
    for (const childId of mod.children) emitChild(childId, items, seen, byId)
    out.push({ entrypoint, items })
  }
  return out
}

const emitChild = (
  id: number,
  out: SurfaceItem[],
  seen: Set<number>,
  byId: Map<number, resolve.Declaration>,
): void => {
  const decl = byId.get(id)
  if (!decl) return
  if (decl.kind === 'exports') {
    for (const entry of decl.names) {
      if (seen.has(entry.id)) continue
      const target = byId.get(entry.id)
      if (!target || !isRoutableKind(target.kind)) continue
      seen.add(entry.id)
      out.push({ id: entry.id, kind: target.kind as Kind, name: entry.name })
    }
    return
  }
  if (!isRoutableKind(decl.kind)) return
  if (seen.has(id)) return
  seen.add(id)
  out.push({ id, kind: decl.kind as Kind })
}

const ROUTABLE: ReadonlySet<string> = new Set([
  'module',
  'namespace',
  'variable',
  'function',
  'class',
  'interface',
  'type-alias',
  'enum',
])

const isRoutableKind = (k: string): boolean => ROUTABLE.has(k)
