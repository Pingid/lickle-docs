import ts from 'typescript'
import mm from 'micromatch'

import * as reflect from '../reflect/index.ts'
import * as config from '../../config/load.ts'
import * as naming from './naming.ts'

export interface ProjectJson {
  /** The name of the project. */
  name: string
  /** The version of the project. */
  version?: string
  /** f */
  repo?: { url: string; rev?: string; fileUrl?: string }
  /** structure */
  pages: Page[]
  /** The exports of the project. */
  exports: { as: string; path: string }[]
  /** Links for the project. */
  links: { label: string; href: string }[]
  /** Entrypoints — relative source paths reachable from `main` / `exports`. */
  entrypoints: string[]
  /** Flat list of every declaration in the project, source order. */
  declarations: reflect.resolver.Declaration[]
  /** Top-level module ids — one per scanned source file. */
  children: number[]
}

export type Page = {
  /** Label used in the navigation */
  label: string
  /** Markdown */
  content: string[]
  /** Slug of the page, used in the URL */
  slug: string
}

export interface ScanOptions {
  dir: string
  exclude?: string[]
}

export const generate = async (options: ScanOptions): Promise<ProjectJson> => {
  const c = await config.load(options.dir)
  const scanned = reflect.scanner.scan(Array.from(c.info.entrypoints), {
    compilerOptions: c.compilerOptions,
    rootDir: options.dir,
    include: (sf) => keepFile(sf, options.exclude),
  })
  const result = reflect.resolver.resolve(scanned)

  naming.stamp(result.declarations)

  return {
    ...c.info,
    declarations: result.declarations,
    children: result.children,
  }
}

const keepFile = (sf: ts.SourceFile, exclude?: string[] | undefined): boolean => {
  if (sf.isDeclarationFile) return false
  if (sf.fileName.includes('/node_modules/')) return false
  if (exclude?.some((i) => mm.isMatch(sf.fileName, i))) return false
  return true
}
