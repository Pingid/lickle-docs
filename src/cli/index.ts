import * as cmd from 'cmd-ts'

import * as cmds from './cmd/index.ts'
import { Pkg } from '../_lib/index.ts'

export const app = async () => {
  const version = await Pkg.read(process.cwd())
  return cmd.subcommands({
    name: 'ldocs',
    version: version.version,
    description: 'Generate documentation sites from TypeScript projects',
    cmds: { ...cmds },
  })
}
