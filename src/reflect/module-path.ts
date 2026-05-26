import path from 'node:path'

/** Anything module-shaped enough to carry a label. Avoids registry variance. */
interface Labeled {
  path?: string
  name?: string
}

/** Stable label for a module — its source path when known, else its declared name. */
export const label = (mod: Labeled): string => mod.path ?? mod.name ?? '<anonymous>'

/**
 * Resolve a module specifier (`./foo`, `react`, `/abs/path`) to a module in the
 * project, given the label of the owning module. Mirrors the candidate-walking
 * resolver that TypeScript uses for relative imports; returns undefined for
 * unresolvable / external specifiers.
 */
export const resolve = <M extends Labeled>(
  ownerLabel: string,
  sourceModule: string,
  modulesByLabel: Map<string, M>,
): M | undefined => {
  if (path.isAbsolute(sourceModule)) return modulesByLabel.get(sourceModule)
  const base = path.isAbsolute(ownerLabel) ? path.resolve(path.dirname(ownerLabel), sourceModule) : sourceModule
  const candidates = pathCandidates(base)
  for (const c of candidates) {
    const m = modulesByLabel.get(c)
    if (m) return m
  }
  const wanted = new Set(candidates.map(normalize))
  for (const m of modulesByLabel.values()) {
    const n = normalize(label(m))
    if (wanted.has(n)) return m
    if ([...wanted].some((x) => n.endsWith(`/${x}`) || n.endsWith(x))) return m
  }
  return undefined
}

const pathCandidates = (base: string): string[] => [
  base,
  `${base}.ts`,
  `${base}.tsx`,
  `${base}.js`,
  `${base}.mjs`,
  path.join(base, 'index.ts'),
  path.join(base, 'index.tsx'),
  path.join(base, 'index.js'),
]

const normalize = (name: string): string =>
  name
    .replaceAll('\\', '/')
    .replace(/^\.\/+/, '')
    .replace(/\/index\.(ts|tsx|js|mjs)$/, '')
    .replace(/\.(ts|tsx|js|mjs)$/, '')
    .replace(/\/+$/, '')
