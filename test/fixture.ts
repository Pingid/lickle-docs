import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ts from 'typescript'

import * as reflect from '../src/core/reflect/index.ts'

/**
 * Scan a single in-memory module end-to-end and return its reflection index.
 * Backed by a real temp file + program so the type checker (and therefore
 * inference) sees the full default lib.
 */
export const scanFixture = (code: string): any => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reflect-'))
  const file = path.join(dir, 'fixture.ts')
  fs.writeFileSync(file, code)
  try {
    return reflect.generate([{ as: 'fixture', path: file }], {
      rootDir: dir,
      compilerOptions: {
        strict: true,
        target: ts.ScriptTarget.Latest,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
      },
      include: (sf) => sf.fileName === file,
    })
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** First declaration with the given name. */
export const byName = <K extends reflect.Declaration['kind'] = reflect.Declaration['kind']>(
  index: any,
  name: string,
): reflect.Declaration<K> => {
  const found = [...index.declarations()].find((d) => d.name === name)
  if (!found) throw new Error(`no declaration named "${name}"`)
  return found as reflect.Declaration<K>
}

/** The resolved `type` of a variable declaration. */
export const typeOf = (index: any, name: string): reflect.Type => byName<'variable'>(index, name).type
