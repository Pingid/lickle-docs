import * as cmd from 'cmd-ts'

import * as project from '../../core/project/index.ts'
import * as config from '../../config/load.ts'
import * as core from '../../core/index.ts'
import * as lib from '../../_lib/index.ts'

export const json = cmd.command({
  name: 'json',
  description: 'Json reflections for a project',
  args: {
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
    const p = await core.project.buildJson(await config.loadGen(process.cwd()))
    if (args.print) project.displayRoutes(p.routes)
  },
})
