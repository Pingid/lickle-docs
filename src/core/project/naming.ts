import type * as resolve from '../reflect/resolver.ts'
import * as lib from '../../_lib/index.ts'

/**
 * Stamp `slug`, `qualifiedName`, `displayName` on every routable declaration.
 * Every scanned file `module` is a root — including those reachable only via
 * re-export (`export * as foo from './other'`), so their namespaces and
 * members become routable too. Modules never nest inside another module's
 * `children` (re-export targets live in `exports.names`), so iterating all
 * modules stamps each exactly once; namespaces/members are reached by
 * recursing through `children`.
 *
 * Non-routable declarations (`exports`) are skipped — they do not own a
 * documentation page.
 *
 * Slug collisions are resolved by appending `-2`, `-3`, … in walk order, so
 * the algorithm is deterministic across runs.
 */
export const stamp = (declarations: resolve.Declaration[]): void => {
  const byId = new Map<number, resolve.Declaration>(declarations.map((d) => [d.id, d]))
  for (const decl of declarations) {
    if (decl.kind === 'module') stampModule(decl, [], byId)
  }
}

const ROUTABLE_KINDS: ReadonlySet<string> = new Set([
  'module',
  'namespace',
  'class',
  'interface',
  'function',
  'variable',
  'enum',
  'type-alias',
])

const stampModule = (mod: resolve.Module, parents: string[], byId: Map<number, resolve.Declaration>): void => {
  const dn = moduleDisplayName(mod)
  const childPrefix = isAnonymous(mod) ? parents : [...parents, dn]
  const qn = childPrefix.join('.') || dn || mod.name || ''
  mod.displayName = dn
  mod.qualifiedName = qn
  mod.slug = lib.slug.make(qn || `r-${mod.id}`)

  for (const childId of mod.children) {
    const child = byId.get(childId)
    if (!child) continue
    stampChild(child, childPrefix, byId)
  }
}

const stampNamespace = (ns: resolve.Namespace, parents: string[], byId: Map<number, resolve.Declaration>): void => {
  const childPrefix = [...parents, ns.name]
  ns.displayName = ns.name
  ns.qualifiedName = childPrefix.join('.')
  ns.slug = lib.slug.make(ns.qualifiedName || `r-${ns.id}`)

  for (const childId of ns.children) {
    const child = byId.get(childId)
    if (!child) continue
    stampChild(child, childPrefix, byId)
  }
}

const stampChild = (decl: resolve.Declaration, parents: string[], byId: Map<number, resolve.Declaration>): void => {
  if (decl.kind === 'module') return stampModule(decl, parents, byId)
  if (decl.kind === 'namespace') return stampNamespace(decl, parents, byId)
  if (ROUTABLE_KINDS.has(decl.kind)) stampRoutable(decl as Routable, parents)
}

type Routable = resolve.Declaration & {
  name: string
  slug: string
  qualifiedName: string
  displayName: string
}

const stampRoutable = (decl: Routable, parents: string[]): void => {
  const qn = [...parents, decl.name].join('.')
  decl.displayName = decl.name
  decl.qualifiedName = qn
  decl.slug = lib.slug.make(qn || `r-${decl.id}`)
}

const moduleDisplayName = (mod: resolve.Module): string => {
  if (mod.name && mod.name !== 'index') return mod.name
  if (mod.path) {
    const parts = mod.path.split('/')
    const last = lib.slug.stripExt(parts[parts.length - 1] ?? '')
    if (last === 'index' && parts.length > 1) return parts[parts.length - 2]!
    return last
  }
  return mod.name ?? '<anonymous>'
}

const isAnonymous = (mod: resolve.Module): boolean => !mod.name && !mod.path
