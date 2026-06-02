import type { ProjectJson } from './types.ts'

export const displayScanned = (json: ProjectJson, prefix: string = '') => {
  for (const m of Object.values(json.modules)) {
    console.log(`${prefix}[${m.id}] ${m.path}`)
    for (const d of m.declarations) {
      const decl = json.declarations[d]
      if (decl?.kind === 'export') {
        if (decl.star) {
          const m = decl.names[0] ? (json.declarations[decl.names[0]!.ref]?.parent ?? decl.names[0]!.ref) : undefined
          const mod = m ? json.modules[m] : undefined
          console.log(`${prefix}  [${d}] exports * from ${mod?.path}`)
          continue
        }
        const exports = decl.star
          ? '*'
          : `(${decl.names
              .map((n) => n.name)
              .slice(0, 3)
              .join(', ')})`
        console.log(`${prefix}  [${d}] exports ${exports}`)
      } else {
        console.log(`${prefix}  [${d}] ${decl?.name}`)
      }
    }
  }
}
