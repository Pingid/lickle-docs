import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ts from 'typescript'

import * as reflect from '../src/core/reflect/index.ts'
import { docRoutes, type Adapter } from '../src/core/route/index.ts'
import { createRouter, type ClientRouter } from '../src/core/route/client/index.ts'

/**
 * Scan a single in-memory module end-to-end and return its reflection index.
 * Backed by a real temp file + program so the type checker (and therefore
 * inference) sees the full default lib.
 */
export const scanFixture = (code: string): reflect.Index => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reflect-'))
  const file = path.join(dir, 'fixture.ts')
  fs.writeFileSync(file, code)
  try {
    const cmd: ts.ParsedCommandLine = {
      fileNames: [file],
      options: {
        strict: true,
        target: ts.ScriptTarget.Latest,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
      },
      errors: [],
    }
    const scanned = reflect.scan({ cmd, dir, srcDir: dir, include: (sf) => sf.fileName === file })
    return reflect.index(reflect.resolve(scanned), [{ as: 'fixture', path: file }])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

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

/**
 * Scan a single module and run the full route pipeline over it: the reflection
 * index, the generated routes, and a client router built from them.
 */
export const routesFixture = (
  code: string,
  adapter?: Adapter,
): { index: reflect.Index; routes: ReturnType<typeof docRoutes>['routes']; slugBase: string; router: ClientRouter } => {
  const index = scanFixture(code)
  const { routes, slugBase } = docRoutes({ docs: index, adapter })
  return { index, routes, slugBase, router: createRouter({ routes, slugBase }) }
}

/** Member titles under a declaration id, flattened across groups in resolved order. */
export const memberTitles = (router: ClientRouter, id: number): string[] =>
  router.members(id).flatMap((g) => g.items.map((i) => i.route.title))

/** Group names (in resolved order) of a declaration's members. */
export const memberGroups = (router: ClientRouter, id: number): string[] => router.members(id).map((g) => g.group)
