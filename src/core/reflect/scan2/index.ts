import type { ScanOptions } from './state.ts'

import { resolve } from './resolve.ts'
import { create } from './graph.ts'
import { scan } from './scan.ts'

export type { ScanOptions } from './state.ts'
export { type Graph } from './graph.ts'

export const generate = (rootFiles: string[], options: ScanOptions) => {
  const s = scan(rootFiles, options)
  const r = resolve(s)
  return create(r, rootFiles)
}
