import * as cmd from 'cmd-ts'

import { Node } from '../../_lib/index.ts'

import * as project from '../../core/project/index.ts'
import * as config from '../../config/load.ts'
import * as core from '../../core/index.ts'

export const json = cmd.command({
  name: 'json',
  description: 'Generate the project\u2019s JSON reflection data into the docs directory',
  args: {
    print: cmd.flag({
      long: 'print',
      short: 'p',
      description: 'Print the generated route tree to the console',
    }),
    full: cmd.flag({
      long: 'full',
      description: 'Document every declaration, not just the exported public API',
    }),
  },
  handler: async (args) => {
    await Node.Fs.ensureDir('docs')
    const p = await core.project.buildJson(await config.load(process.cwd(), { full: args.full }))
    if (args.print) project.displayRoutes(p.legacyRoutes)
    await Node.Fs.writeFile('docs/project.json', JSON.stringify(p, null, 2))
  },
})
