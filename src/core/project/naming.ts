import type * as resolve from '../reflect/resolve.ts'

/**
 * Stamp `slug`, `qualifiedName`, `displayName` on every routable declaration.
 * Walks each top-level module top-down via the flat declarations list,
 * accumulating the qualified-name prefix as it descends into TS namespaces.
 *
 * Non-routable declarations (`exports`) are skipped — they do not own a
 * documentation page.
 *
 * Slug collisions are resolved by appending `-2`, `-3`, … in walk order, so
 * the algorithm is deterministic across runs.
 */
export const stamp = (declarations: resolve.Declaration[], topIds: number[]): void => {
  const byId = new Map<number, resolve.Declaration>(declarations.map((d) => [d.id, d]))
  const used = new Set<string>()
  for (const id of topIds) {
    const mod = byId.get(id)
    if (mod && mod.kind === 'module') stampModule(mod, [], used, byId)
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

const stampModule = (
  mod: resolve.Module,
  parents: string[],
  used: Set<string>,
  byId: Map<number, resolve.Declaration>,
): void => {
  const dn = moduleDisplayName(mod)
  const childPrefix = isAnonymous(mod) ? parents : [...parents, dn]
  const qn = childPrefix.join('.') || dn || mod.name || ''
  mod.displayName = dn
  mod.qualifiedName = qn
  mod.slug = uniqueSlug(toSlug(qn) || `r-${mod.id}`, used)

  for (const childId of mod.children) {
    const child = byId.get(childId)
    if (!child) continue
    stampChild(child, childPrefix, used, byId)
  }
}

const stampNamespace = (
  ns: resolve.Namespace,
  parents: string[],
  used: Set<string>,
  byId: Map<number, resolve.Declaration>,
): void => {
  const childPrefix = [...parents, ns.name]
  ns.displayName = ns.name
  ns.qualifiedName = childPrefix.join('.')
  ns.slug = uniqueSlug(toSlug(ns.qualifiedName) || `r-${ns.id}`, used)

  for (const childId of ns.children) {
    const child = byId.get(childId)
    if (!child) continue
    stampChild(child, childPrefix, used, byId)
  }
}

const stampChild = (
  decl: resolve.Declaration,
  parents: string[],
  used: Set<string>,
  byId: Map<number, resolve.Declaration>,
): void => {
  if (decl.kind === 'module') return stampModule(decl, parents, used, byId)
  if (decl.kind === 'namespace') return stampNamespace(decl, parents, used, byId)
  if (ROUTABLE_KINDS.has(decl.kind)) stampRoutable(decl as Routable, parents, used)
}

type Routable = resolve.Declaration & {
  name: string
  slug: string
  qualifiedName: string
  displayName: string
}

const stampRoutable = (decl: Routable, parents: string[], used: Set<string>): void => {
  const qn = [...parents, decl.name].join('.')
  decl.displayName = decl.name
  decl.qualifiedName = qn
  decl.slug = uniqueSlug(toSlug(qn) || `r-${decl.id}`, used)
}

const moduleDisplayName = (mod: resolve.Module): string => {
  if (mod.name && mod.name !== 'index') return mod.name
  if (mod.path) {
    const parts = mod.path.split('/')
    const last = stripExt(parts[parts.length - 1] ?? '')
    if (last === 'index' && parts.length > 1) return parts[parts.length - 2]!
    return last
  }
  return mod.name ?? '<anonymous>'
}

const isAnonymous = (mod: resolve.Module): boolean => !mod.name && !mod.path

const stripExt = (s: string): string => s.replace(/\.[^./]+$/, '')

const toSlug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')

const uniqueSlug = (base: string, used: Set<string>): string => {
  if (!used.has(base)) {
    used.add(base)
    return base
  }
  let n = 2
  while (used.has(`${base}-${n}`)) n++
  const slug = `${base}-${n}`
  used.add(slug)
  return slug
}
