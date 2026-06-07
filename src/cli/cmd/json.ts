import * as cmd from 'cmd-ts'

import { Node } from '../../_lib/index.ts'

import { Router, Config, buildDocs } from '../../core/index.ts'

export const json = cmd.command({
  name: 'json',
  description: 'Generate the project\u2019s JSON reflection data into the docs directory',
  args: {
    print: cmd.flag({
      long: 'print',
      short: 'p',
      description: 'Print the generated route tree to the console',
    }),
  },
  handler: async (args) => {
    await Node.Fs.ensureDir('docs')
    const load = await Config.load(process.cwd())
    const p = await buildDocs(process.cwd(), load.config)
    if (args.print) Router.printRoutes(p)
    await Node.Fs.writeFile('docs/project.json', JSON.stringify(p, null, 2))
  },
})
