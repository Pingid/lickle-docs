import type { ScanOptions } from './state.ts'

import * as indexed from './indexed.ts'
import { resolve } from './resolve.ts'
import { compact } from './compact.ts'
import { scan } from './scan.ts'

export type { ScanOptions } from './state.ts'
export { type Index } from './indexed.ts'
export type * from './types.ts'

export const generate = (rootFiles: { as: string; path: string }[], options: ScanOptions) => {
  const s = scan(
    rootFiles.map((r) => r.path),
    options,
  )
  const r = resolve(s)
  console.log(compact(r, rootFiles))
  return indexed.create(r, rootFiles)
}
