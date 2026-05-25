import fs from 'node:fs/promises'
import * as cmd from 'cmd-ts'
import path from 'node:path'

import { reflect, typedoc, workspace } from '../lib.ts'

export const app = () =>
  cmd.subcommands({
    name: 'docs',
    description: 'Documentation generation',
    cmds: { json, typedoc: typdoc },
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
    projectName: cmd.option({
      long: 'project-name',
      short: 'p',
      type: cmd.optional(cmd.string),
      description: 'Name of the project',
    }),
    files: cmd.restPositionals({ type: cmd.string, description: 'Files to include in the project' }),
  },
  handler: async (args) => {
    const projectName = await workspace.projectName(args.projectName)
    const options = await workspace.tsconfig(args.tsconfig)
    const files = args.files.length ? args.files.map((f) => path.resolve(f)) : options.fileNames
    const project = reflect.generate(projectName ?? 'my-project', files, options.options, {})
    await fs.writeFile('reflect.json', JSON.stringify(project))
  },
})

const typdoc = cmd.command({
  name: 'typedoc',
  description: 'Typdoc reflections for a project',
  args: { files: cmd.restPositionals({ type: cmd.string }) },
  handler: async (args) => {
    await typedoc.generate(args.files)
  },
})
