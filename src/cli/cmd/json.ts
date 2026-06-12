import * as cmd from 'cmd-ts'

import { Node } from '../../_lib/index.ts'

import { Router, Build } from '../../core/index.ts'

export const generate = cmd.command({
  name: 'generate',
  description: 'Generate the project\u2019s JSON reflection data',
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
      defaultValue: () => 'ldocs.json' as const,
      defaultValueIsSerializable: true,
      description: 'File to write the project JSON to',
    }),
  },
  handler: async (args) => {
    const p = await Build.build(process.cwd())
    if (args.print) Router.printRoutes(p.json)
    await Node.Fs.ensureDir(args.file)
    await Node.Fs.writeFile(args.file, JSON.stringify(p.json))
  },
})
