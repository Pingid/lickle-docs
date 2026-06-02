import type { ScanState } from './state.ts'

interface Compacted {
  files: string[]
}

export const compact = (s: ScanState, rootFiles: { as: string; path: string }[]): Compacted => {
  return {
    files: [],
  }
}
