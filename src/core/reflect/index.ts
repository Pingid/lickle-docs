import type { ScanOptions, ScanState } from './state.ts'

import * as indexed from './indexed.ts'
import { resolve } from './resolve.ts'
import { scan } from './scan.ts'

export type { ScanOptions } from './state.ts'
export { type Index } from './indexed.ts'
export type * from './types.ts'

export const generate = (rootFiles: { as: string; path: string }[], options: ScanOptions) =>
  resolve(
    scan(
      rootFiles.map((r) => r.path),
      options,
    ),
  )

export const index = (s: ScanState, rootFiles: { as: string; path: string }[]) => indexed.create(s, rootFiles)
