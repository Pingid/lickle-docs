import * as modulePath from '../reflect/module-path.ts'
import type * as resolve from '../reflect/resolve.ts'

export type Kind = 'module' | 'variable' | 'function' | 'class' | 'interface' | 'type-alias' | 'enum'

export interface SurfaceEntry {
  /** Relative source path of the entrypoint module. */
  entrypoint: string
  /** Routable items the entrypoint exposes, in source order. */
  items: { id: number; kind: Kind }[]
}

/**
 * Public surface for each entrypoint — the list of routable items reachable
 * from the entrypoint module, with re-exports flattened to their targets.
 *
 * `namespace` re-exports become a `{ kind: 'module' }` item pointing at the
 * source module so the renderer can link straight there.
 */
export const compute = (entrypoints: string[], modules: resolve.Module[]): SurfaceEntry[] => {
  const declsById = new Map<number, resolve.Declaration>()
  const modulesByLabel = new Map<string, resolve.Module>()
  for (const m of modules) collectIds(m, declsById, modulesByLabel)

  const out: SurfaceEntry[] = []
  for (const entrypoint of entrypoints) {
    const mod = modulesByLabel.get(entrypoint)
    if (!mod) continue
    const items: SurfaceEntry['items'] = []
    const seen = new Set<number>()
    for (const child of mod.children) emitChild(child, mod, modulesByLabel, declsById, items, seen)
    out.push({ entrypoint, items })
  }
  return out
}

const collectIds = (
  mod: resolve.Module,
  declsById: Map<number, resolve.Declaration>,
  modulesByLabel: Map<string, resolve.Module>,
): void => {
  modulesByLabel.set(modulePath.label(mod), mod)
  declsById.set(mod.id, mod)
  for (const child of mod.children) {
    if (child.kind === 'module') collectIds(child, declsById, modulesByLabel)
    else declsById.set(child.id, child)
  }
}

const emitChild = (
  child: resolve.Declaration,
  owner: resolve.Module,
  modulesByLabel: Map<string, resolve.Module>,
  declsById: Map<number, resolve.Declaration>,
  out: { id: number; kind: Kind }[],
  seen: Set<number>,
): void => {
  if (child.kind === 're-export') {
    if (child.form === 'namespace') {
      const target = modulePath.resolve(modulePath.label(owner), child.sourceModule, modulesByLabel)
      if (target && !seen.has(target.id)) {
        seen.add(target.id)
        out.push({ id: target.id, kind: 'module' })
      }
      return
    }
    for (const id of child.ids) {
      if (seen.has(id)) continue
      const decl = declsById.get(id)
      if (!decl || !isRoutableKind(decl.kind)) continue
      seen.add(id)
      out.push({ id, kind: decl.kind as Kind })
    }
    return
  }
  if (!isRoutableKind(child.kind)) return
  if (seen.has(child.id)) return
  seen.add(child.id)
  out.push({ id: child.id, kind: child.kind as Kind })
}

const ROUTABLE: ReadonlySet<string> = new Set([
  'module',
  'variable',
  'function',
  'class',
  'interface',
  'type-alias',
  'enum',
])

const isRoutableKind = (k: string): boolean => ROUTABLE.has(k)
