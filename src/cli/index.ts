import fs from 'node:fs/promises'
import * as cmd from 'cmd-ts'
import path from 'node:path'

import * as project from '../core/project/index.ts'
import * as config from '../config/load.ts'
import * as lib from '../_lib/index.ts'
import * as cmds from './cmd/index.ts'

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
    print: cmd.flag({
      long: 'print',
      short: 'p',
      description: 'Print the routes to the console',
    }),
    full: cmd.flag({
      long: 'full',
      description: 'Document every declaration, not just the exported public API',
    }),
  },
  handler: async (args) => {
    await lib.fs.ensureDir('docs')
    const p = await generate('docs/docs.json', process.cwd(), { exclude: args.exclude, full: args.full })
    if (args.print) project.displayRoutes(p.routes)
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
    force: cmd.flag({
      long: 'force',
      short: 'f',
      description: 'Force init even if the docs directory already exists',
    }),
  },
  handler: async (args) => {
    if (args.force) {
      const dir = args.docsDir ? path.resolve(args.docsDir) : path.join(process.cwd(), 'docs')
      await fs.rm(dir, { recursive: true })
    }
    init(args)
  },
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
  handler: async (args) => cmds.dev.run(args),
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
  handler: async (args) => console.log('build', args),
})

// const build = async (args: { docsDir?: string }) => {
//   const dir = args.docsDir ? path.resolve(args.docsDir) : path.join(process.cwd(), 'docs')
//   if (!(await stat(dir))) await fs.mkdir(dir, { recursive: true })
//   const docsPath = path.join(dir, 'docs.json')
//   const p = await generate(docsPath, process.cwd())
//   // await client.build({ docsDir: dir, outDir: path.join(dir, 'dist'), name: p.name })
// }

const init = async (args: { docsDir?: string }) => {
  const dir = args.docsDir ? path.resolve(args.docsDir) : path.join(process.cwd(), 'docs')
  await fs.mkdir(dir, { recursive: true })
  await generate(path.join(dir, 'docs.json'), process.cwd())
  await writeInitFiles(dir)
}

const generate = async (out: string, dir: string, opts?: Partial<config.ConfigJson>) => {
  const c = await config.loadGen(dir, opts)
  const p = await project.buildJson(c)
  await fs.writeFile(out, JSON.stringify(p))
  return p
}

const initFiles = {
  '.gitignore': [`docs.json`, `dist`],
  'index.tsx': [
    `import { create, type ProjectJson } from '@lickle/docs/preset'`,
    `import json from './docs.json'\n`,
    `create({ json: json as ProjectJson })`,
  ],
  'tsconfig.json': [`{`, `  "extends": "@lickle/docs/tsconfig.json",`, `  "include": ["*"],`, `}`],
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
