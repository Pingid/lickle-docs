import fs from 'node:fs/promises'
import * as cmd from 'cmd-ts'
import path from 'node:path'

import { client, watch, promise } from '../cli/util/index.ts'
import * as project from '../core/project/json.ts'

export const app = () =>
  cmd.subcommands({
    name: 'docs',
    description: 'Documentation generation',
    cmds: { json: cmdJson, dev: cmdDev, init: cmdInit, build: cmdBuild },
  })

const cmdJson = cmd.command({
  name: 'json',
  description: 'Json reflections for a project',
  args: {
    tsconfig: cmd.option({
      long: 'tsconfig',
      short: 't',
      type: cmd.optional(cmd.string),
      description: 'Path to tsconfig.json',
    }),
    packageJson: cmd.option({
      long: 'package-json',
      short: 'p',
      type: cmd.optional(cmd.string),
      description: 'Path to package.json',
    }),
    exclude: cmd.multioption({
      long: 'exclude',
      short: 'e',
      type: cmd.array(cmd.string),
      description: 'Glob pattern of files to exclude from the project',
    }),
    include: cmd.restPositionals({
      type: cmd.string,
      description: 'Glob pattern of files to include in the project',
    }),
  },
  handler: async (args) => {
    const opts: project.ScanOptions = { dir: process.cwd(), tsConfigPath: args.tsconfig, exclude: args.exclude }
    await generate('reflect.json', opts)
  },
})

const cmdInit = cmd.command({
  name: 'init',
  description: 'Init',
  args: {
    docsDir: cmd.option({
      long: 'docs-dir',
      short: 'd',
      type: cmd.optional(cmd.string),
      description: 'Path to the docs directory',
    }),
  },
  handler: async (args) => init(args),
})

const cmdDev = cmd.command({
  name: 'dev',
  description: 'Dev server for a project',
  args: {
    docsDir: cmd.option({
      long: 'docs-dir',
      short: 'd',
      type: cmd.optional(cmd.string),
      description: 'Path to the docs directory',
    }),
    port: cmd.option({
      long: 'port',
      short: 'p',
      type: cmd.optional(cmd.number),
      description: 'Port to listen on',
    }),
  },
  handler: async (args) => dev(args),
})

const cmdBuild = cmd.command({
  name: 'build',
  description: 'Build the project',
  args: {
    docsDir: cmd.option({
      long: 'docs-dir',
      short: 'd',
      type: cmd.optional(cmd.string),
      description: 'Path to the docs directory',
    }),
  },
  handler: async (args) => build(args),
})

const build = async (args: { docsDir?: string }) => {
  const dir = args.docsDir ? path.resolve(args.docsDir) : path.join(process.cwd(), 'docs')
  if (!(await stat(dir))) await fs.mkdir(dir, { recursive: true })
  const docsPath = path.join(dir, 'docs.json')
  const p = await generate(docsPath, { dir: process.cwd() })
  await client.build({ docsDir: dir, outDir: path.join(dir, 'dist'), name: p.name })
}

const dev = async (args: { docsDir?: string; port?: number }) => {
  const dir = args.docsDir ? path.resolve(args.docsDir) : path.join(process.cwd(), 'docs')
  if (!(await stat(dir))) await fs.mkdir(dir, { recursive: true })

  let name: string | undefined
  let dirs: string[] = []
  const docsPath = path.join(dir, 'docs.json')
  const rebuild = promise.serial(async () => {
    console.log(`Rebuilding project...`)
    const p = await generate(docsPath, { dir: process.cwd() })
    dirs = Array.from(new Set(p.surface.map((s) => path.resolve(path.dirname(s.entrypoint)))))
    name = p.name
    console.log(`Project rebuilt: ${p.name}`)
  })
  await rebuild()

  const watcher = watch.dirs([...dirs], rebuild)
  const server = await client.dev({ docsDir: dir, port: args.port, name: name! })

  const cleanup = async () => {
    watcher.stop()
    await server.close()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
}

const init = async (args: { docsDir?: string }) => {
  const dir = args.docsDir ? path.resolve(args.docsDir) : path.join(process.cwd(), 'docs')
  await fs.mkdir(dir, { recursive: true })
  await generate(path.join(dir, 'docs.json'), { dir: process.cwd() })
  await writeInitFiles(dir)
}

const generate = async (out: string, opts: project.ScanOptions) => {
  const p = await project.generate(opts)
  await fs.writeFile(out, JSON.stringify(p))
  return p
}

const initFiles = {
  '.gitignore': [`docs.json`, `dist`],
  'index.tsx': [
    `import { create, type ProjectJson } from '@lickle/docs/preset'\n`,
    `import json from './docs.json'\n`,
    `create({ json: json as ProjectJson })`,
  ],
  'tsconfig.json': [`{`, `  "extends": "@lickle/docs/preset/tsconfig.json",`, `  "include": ["*"],`, `}`],
}
const writeInitFiles = async (dir: string) => {
  for (const [file, content] of Object.entries(initFiles)) {
    if (await stat(path.join(dir, file))) {
      console.log(`skipping ${file} as it already exists`)
      continue
    }
    await fs.writeFile(path.join(dir, file), content.join('\n'))
  }
}

const stat = async (path: string): Promise<Awaited<ReturnType<typeof fs.stat>> | undefined> =>
  fs.stat(path).catch(() => undefined)
