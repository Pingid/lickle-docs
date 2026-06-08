import * as cmd from 'cmd-ts'

import { Node } from '../../_lib/index.ts'

import { Router, Build } from '../../core/index.ts'

export const json = cmd.command({
  name: 'json',
  description: 'Generate the project\u2019s JSON reflection data into the docs directory',
  args: {
    print: cmd.flag({
      long: 'print',
      short: 'p',
      description: 'Print the generated route tree to the console',
    }),
    file: cmd.option({
      long: 'file',
      short: 'f',
      type: cmd.string,
      defaultValue: () => 'docs/project.json' as const,
      defaultValueIsSerializable: true,
      description: 'File to write the project JSON to',
    }),
  },
  handler: async (args) => {
    const p = await Build.build(process.cwd())
    if (args.print) Router.printRoutes(p.json.routes)
    await Node.Fs.ensureDir(args.file)
    await Node.Fs.writeFile(args.file, JSON.stringify(p.json))
  },
})
