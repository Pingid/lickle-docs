import fs from 'node:fs/promises'
import * as cmd from 'cmd-ts'

import * as project from '../project/json.ts'

export const app = () =>
  cmd.subcommands({
    name: 'docs',
    description: 'Documentation generation',
    cmds: { json },
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
