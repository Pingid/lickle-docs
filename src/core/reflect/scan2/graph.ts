import * as path from '../../../_lib/path/index.ts'

import type { ScanState } from './state.ts'
import * as T from '../types.ts'

export type Graph = {
  get: (id: number) => T.Declaration | undefined
  roots: () => Iterable<T.Declaration>
  children: (id: number) => Iterable<T.Declaration>
  declarations: () => T.Declaration[]
  files: () => Iterable<string>
}

export const create = (s: ScanState, rootFiles: string[]): Graph => {
  const byId = new Map<number, T.Declaration>()
  const byParent = new Map<number, Set<number>>()
  const byPath = new Map<string, number>()

  for (const decl of s.declarations) {
    byId.set(decl.id, decl)

    const parent = decl.parent
    let children = byParent.get(parent)
    if (!children) byParent.set(parent, (children = new Set()))
    children.add(decl.id)

    if (decl.kind === 'module' && decl.path) byPath.set(decl.path!, decl.id)
  }

  const srcDir = path.common(Array.from(byPath.keys()))
  console.log(srcDir)
  return {
    get: (id: number) => byId.get(id),
    declarations: () => s.declarations,
    *roots() {
      for (const f of rootFiles) {
        const id = byPath.get(f)
        if (id) yield byId.get(id)!
      }
    },
    *children(id: number) {
      for (const child of byParent.get(id) ?? EMPTY) yield byId.get(child)!
    },
    files: () => byPath.keys(),
  }
}

const EMPTY = new Set<number>()
