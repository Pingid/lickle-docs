import path from 'node:path'
import ts from 'typescript'
import fs from 'node:fs'
import os from 'node:os'

import * as reflect from '../src/core/reflect/index.ts'

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
      emit: () => {},
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
