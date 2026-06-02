import type { ScanOptions } from './state.ts'

import { resolve } from './resolve.ts'
import { scan } from './scan.ts'

export type { ScanOptions } from './state.ts'
export type * from './types.ts'

export const generate = (rootFiles: { as: string; path: string }[], options: ScanOptions) => {
  const s = scan(
    rootFiles.map((r) => r.path),
    options,
  )
  const r = resolve(s)
  return { declarations: r.declarations, modules: r.modules, sources: r.sources, comments: r.comments }
}
