import type { ScanContext } from './state.ts'

interface Compacted {
  files: string[]
}

export const compact = (_s: ScanContext, _rootFiles: { as: string; path: string }[]): Compacted => {
  return {
    files: [],
  }
}
