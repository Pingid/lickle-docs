import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import mm from 'micromatch'
import fg from 'fast-glob'

import * as pkgJson from '../pkg-json/index.ts'
import * as tsconf from '../tsconfig/index.ts'
import * as reflect from '../reflect/index.ts'
import { spawnSync } from 'node:child_process'

export interface ProjectJson {
  /** The name of the project. */
  name: string
  /** The version of the project. */
  version?: string
  /** The readme of the project. */
  readme?: string
  /** The main entrypoint of the project. */
  main?: string
  /** The exports of the project. */
  exports: { name: string; path: string }[]
  /** Git hash of the project. */
  hash?: string
  /** Entrypoints for reflections */
  entrypoints: string[]
  /** Top-level reflections — one per scanned source file. */
  reflections: reflect.resolve.Module[]
  /** Links for the project. */
  links: { label: string; href: string }[]
}

export interface ScanOptions {
  dir: string
  exclude?: string[]
  include?: string[]
  tsConfigPath?: string
}

export const generate = async (options: ScanOptions): Promise<ProjectJson> => {
  const json = await pkgJson.read(path.join(options.dir, 'package.json'))
  const tsConfig = await findAndParseTsConfig(options.tsConfigPath)

  const links: ProjectJson['links'] = []
  const files = new Set<string>()
  const exports: { name: string; path: string }[] = []

  if (json.repository?.url) {
    links.push({ label: 'Repository', href: json.repository.url })
  }

  if (!options.include?.length) {
    const entrypoint = json.module ?? json.main ?? json.types
    if (entrypoint) {
      const pth = resolveEntry(options.dir, entrypoint, tsConfig)
      if (pth) files.add(pth)
    }

    for await (const e of pkgJson.exports(options.dir, json)) {
      const pth = resolveEntry(options.dir, e.path, tsConfig)
      if (pth) {
        files.add(pth)
        exports.push({ name: e.name, path: path.relative(options.dir, pth) })
      }
    }
  } else {
    for (const i of options.include) {
      const pth = await fg.glob(i, { cwd: options.dir })
      for (const p of pth) files.add(p)
    }
  }

  const readme = await fs.readFile(path.join(options.dir, 'README.md'), 'utf-8').catch(() => undefined)
  const version = json.version
  const name = json.name ?? 'Unknown'
  const generation = reflect.scan.files(Array.from(files), {
    compilerOptions: tsConfig.options,
    rootDir: options.dir,
    include: {
      file: (sf) => {
        if (options.exclude?.some((i) => mm.isMatch(sf.fileName, i))) return false
        if (sf.isDeclarationFile) return false
        if (sf.fileName.includes('/node_modules/')) return false
        return true
      },
    },
  })
  const reflections = reflect.resolve.generation(generation)

  const relativeEntrypoints = Array.from(files).map((f) => path.relative(options.dir, f))

  const hash = (() => {
    try {
      return spawnSync('git', ['rev-parse', 'HEAD', '--short']).stdout.toString().trim()
    } catch (error) {
      return undefined
    }
  })()

  return { name, version, readme, entrypoints: relativeEntrypoints, reflections, exports, links: [], hash }
}

const resolveEntry = (dir: string, pth: string, tsConfig: ts.ParsedCommandLine) => {
  if (tsConfig.options.outDir) pth = pth.replace(path.relative(dir, tsConfig.options.outDir), '')
  pth = pth.replace(path.extname(pth), '').replace(/^\//, '')
  const f = tsConfig.fileNames.find((f) => f.replace(path.extname(f), '').endsWith(pth))
  return f
}

const findAndParseTsConfig = async (tsconfigPath?: string): Promise<ts.ParsedCommandLine & { json: any }> => {
  let pth = tsconfigPath
  if (!pth) pth = await tsconf.find()
  if (!pth) throw new Error('No tsconfig.json found')
  const json = tsconf.read(pth)
  return { ...tsconf.parse(pth, json), json }
}
