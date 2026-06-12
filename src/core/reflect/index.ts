import type { ScanOptions, ScanState } from './state.ts'

import * as indexed from './indexed.ts'
import * as Resolve from './resolve.ts'
import * as Scan from './scan/index.ts'

export type { ScanOptions } from './state.ts'
export { type Index } from './indexed.ts'
export type * from './types.ts'

export const scanSync = (options: ScanOptions) => Scan.scanSync(options)

export const scanAsync = (options: ScanOptions, abortSignal?: AbortSignal) => Scan.scanAsync(options, abortSignal)

export const resolve = (s: ScanState) => Resolve.resolve(s)

export const index = (s: ScanState, entrypoints: { as: string; path: string }[]) => indexed.create(s, entrypoints)
