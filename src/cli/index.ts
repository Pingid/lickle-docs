import * as cmd from 'cmd-ts'

import * as cmds from './cmd/index.ts'

export const app = () =>
  cmd.subcommands({
    name: 'docs',
    description: 'Documentation generation',
    cmds: { json: cmds.json, dev: cmds.dev, init: cmds.init, build: cmds.build },
  })
