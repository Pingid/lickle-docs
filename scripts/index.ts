import * as cmd from 'cmd-ts'
import pc from 'picocolors'

import { cli } from './cli'

cmd.run(cli, process.argv.slice(2)).catch((err) => {
  console.error(pc.red(err?.message ?? err))
  process.exit(1)
})
