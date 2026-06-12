import path from 'node:path'
import ts from 'typescript'
import fs from 'node:fs'
import os from 'node:os'

import {
  createRouter,
  type ClientRouter,
  type GroupedItems,
  type Route,
  type SidebarRoute,
} from '../src/core/route/client/index.ts'
import { builder, type Adapter } from '../src/core/route/index.ts'
import * as reflect from '../src/core/reflect/index.ts'

/** Slug prefix applied to every fixture router, so doc slugs read as `l/...`. */
const PREFIX = { doc: 'l', page: '' }

/** Materialise `files` in a fresh temp dir, run `fn`, then clean up. */
const withTemp = <T>(files: Record<string, string>, fn: (dir: string, fileNames: string[]) => T): T => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reflect-'))
  const fileNames = Object.entries(files).map(([name, code]) => {
    const file = path.join(dir, name)
    fs.writeFileSync(file, code)
    return file
  })
  try {
    return fn(dir, fileNames)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Scan several in-memory modules and return the merged reflection index.
 * `files` maps file name to source; `entries` lists the entrypoint labels and
 * the files they point at. Relative imports between fixture files must be
 * extensionless (`./shared`). Backed by a real temp program so the type checker
 * (and therefore inference) sees the full default lib.
 */
export const multiScanFixture = (
  files: Record<string, string>,
  entries: { as: string; file: string }[],
): reflect.Index =>
  withTemp(files, (dir, fileNames) => {
    const cmd: ts.ParsedCommandLine = {
      fileNames,
      options: {
        strict: true,
        target: ts.ScriptTarget.Latest,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
      },
      errors: [],
    }
    return reflect.build({
      cmd,
      dir,
      srcDir: dir,
      include: (sf) => fileNames.includes(sf.fileName),
      entrypoints: entries.map((e) => ({ as: e.as, path: path.join(dir, e.file) })),
    })
  })

/**
 * Scan a single in-memory module end-to-end and return its reflection index.
 */
export const scanFixture = (code: string): reflect.Index =>
  multiScanFixture({ 'fixture.ts': code }, [{ as: 'fixture', file: 'fixture.ts' }])

/** First declaration with the given name. */
export const byName = <K extends reflect.Declaration['kind'] = reflect.Declaration['kind']>(
  index: reflect.Index,
  name: string,
): reflect.Declaration<K> => {
  const found = [...index.declarations()].find((d) => d.name === name)
  if (!found) throw new Error(`no declaration named "${name}"`)
  return found as reflect.Declaration<K>
}

/** The resolved `type` of a variable declaration. */
export const typeOf = (index: reflect.Index, name: string): reflect.Type => byName<'variable'>(index, name).type

type RoutesFixture = {
  index: reflect.Index
  routes: Route[]
  declarations: reflect.Declaration[]
  router: ClientRouter
}

/** Run the full route pipeline over an already-scanned index. */
const routesOf = (index: reflect.Index, adapter?: Adapter): RoutesFixture => {
  const b = builder({ docs: index, name: 'fixture', adapter })
  for (const decl of index.declarations()) b.declare(decl)
  const { routes, declarations } = b.build()
  return { index, routes, declarations, router: createRouter({ routes, prefix: PREFIX }) }
}

/**
 * Scan several in-memory modules with multiple entrypoints and run the full
 * route pipeline. See {@link multiScanFixture} for the `files`/`entries` shape.
 */
export const multiRoutesFixture = (
  files: Record<string, string>,
  entries: { as: string; file: string }[],
  adapter?: Adapter,
): RoutesFixture => routesOf(multiScanFixture(files, entries), adapter)

/**
 * Scan a single module and run the full route pipeline over it: the reflection
 * index, the generated routes (and the declarations backing them), and a client
 * router built from them.
 */
export const routesFixture = (code: string, adapter?: Adapter): RoutesFixture => routesOf(scanFixture(code), adapter)

/** Locate a declaration's node in the sidebar tree by its id. */
const sidebarNode = (groups: GroupedItems<SidebarRoute>[], id: number): SidebarRoute | undefined => {
  for (const group of groups) {
    for (const item of group.items) {
      if (item.kind === 'doc' && item.decl === id) return item
      const found = sidebarNode(item.children, id)
      if (found) return found
    }
  }
  return undefined
}

/** The sidebar children of the route with `id`, grouped by kind. */
const childrenOf = (router: ClientRouter, id: number): GroupedItems<SidebarRoute>[] =>
  sidebarNode(router.sidebar, id)?.children ?? []

/** Member titles under a declaration id, flattened across groups in resolved order. */
export const memberTitles = (router: ClientRouter, id: number): string[] =>
  childrenOf(router, id).flatMap((g) => g.items.map((r) => r.title))

/** Branch-contextual sidebar aliases under a declaration id, flattened in resolved order. */
export const memberAliases = (router: ClientRouter, id: number): string[] =>
  childrenOf(router, id).flatMap((g) => g.items.map((r) => r.alias ?? r.title))

/** Group names (in resolved order) of a declaration's members. */
export const memberGroups = (router: ClientRouter, id: number): string[] => childrenOf(router, id).map((g) => g.group)
