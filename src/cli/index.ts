import fs from 'node:fs/promises'
import * as cmd from 'cmd-ts'
import path from 'node:path'

import * as project from '../core/project/json.ts'
import { client } from '../cli/util/index.ts'

export const app = () =>
  cmd.subcommands({
    name: 'docs',
    description: 'Documentation generation',
    cmds: { json, dev },
  })

const json = cmd.command({
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
    const p = await project.generate({ dir: process.cwd(), tsConfigPath: args.tsconfig, exclude: args.exclude })
    await fs.writeFile('reflect.json', JSON.stringify(p))
  },
})

const dev = cmd.command({
  name: 'dev',
  description: 'Dev server for a project',
  args: {
    dir: cmd.option({
      long: 'dir',
      short: 'd',
      type: cmd.optional(cmd.string),
      description: 'Path to the project directory',
    }),
    port: cmd.option({
      long: 'port',
      short: 'p',
      type: cmd.optional(cmd.number),
      description: 'Port to listen on',
    }),
  },
  handler: async (args) => {
    const dir = args.dir ?? path.join(process.cwd(), 'docs')
    if (
      !(await fs
        .stat(dir)
        .then((stat) => stat.isDirectory())
        .catch(() => false))
    ) {
      await fs.mkdir(dir, { recursive: true })
    }
    await client.dev({ dir, port: args.port })
  },
})
