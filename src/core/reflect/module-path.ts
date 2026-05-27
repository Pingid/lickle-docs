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
 *
 * Uses only string ops — no `node:path` — so this is safe to run in the browser.
 */
export const resolve = <M extends Labeled>(
  ownerLabel: string,
  sourceModule: string,
  modulesByLabel: Map<string, M>,
): M | undefined => {
  if (isAbsolute(sourceModule)) return modulesByLabel.get(sourceModule)
  const base = isAbsolute(ownerLabel) ? joinPath(dirname(ownerLabel), sourceModule) : sourceModule
  const candidates = pathCandidates(base)
  for (const c of candidates) {
    const m = modulesByLabel.get(c)
    if (m) return m
  }
  const wanted = new Set(candidates.map(normalize))
  for (const m of modulesByLabel.values()) {
    const n = normalize(label(m))
    if (wanted.has(n)) return m
    for (const x of wanted) if (n.endsWith(`/${x}`) || n.endsWith(x)) return m
  }
  return undefined
}

const pathCandidates = (base: string): string[] => [
  base,
  `${base}.ts`,
  `${base}.tsx`,
  `${base}.js`,
  `${base}.mjs`,
  joinPath(base, 'index.ts'),
  joinPath(base, 'index.tsx'),
  joinPath(base, 'index.js'),
]

const normalize = (name: string): string =>
  name
    .replaceAll('\\', '/')
    .replace(/^\.\/+/, '')
    .replace(/\/index\.(ts|tsx|js|mjs)$/, '')
    .replace(/\.(ts|tsx|js|mjs)$/, '')
    .replace(/\/+$/, '')

// ---------------- Path primitives (POSIX-style, no node:path) ----------------

const isAbsolute = (p: string): boolean => p.startsWith('/') || p.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(p)

const dirname = (p: string): string => {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  if (i < 0) return '.'
  if (i === 0) return '/'
  return p.slice(0, i)
}

/** Join two segments and collapse `.` / `..` runs. POSIX output. */
const joinPath = (a: string, b: string): string => {
  const abs = isAbsolute(a)
  const out: string[] = []
  for (const part of `${a}/${b}`.split(/[\\/]+/)) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop()
      else if (!abs) out.push('..')
      continue
    }
    out.push(part)
  }
  const joined = out.join('/')
  return abs ? `/${joined}` : joined || '.'
}
