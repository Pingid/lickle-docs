import * as cmd from 'cmd-ts'
import pc from 'picocolors'

import { Node } from '../../_lib/index.ts'

import { Build } from '../../core/index.ts'
import { printSite } from '../../core/layout/debug.ts'

export const generate = cmd.command({
  name: 'generate',
  description: 'Generate the project\u2019s JSON reflection data',
  args: {
    print: cmd.flag({
      long: 'print',
      short: 'p',
      description: 'Print the generated page list and sidebar tree to the console',
    }),
    file: cmd.option({
      long: 'file',
      short: 'f',
      type: cmd.string,
      defaultValue: () => 'ldocs.json' as const,
      defaultValueIsSerializable: true,
      description: 'File to write the project JSON to',
    }),
    strict: cmd.flag({
      long: 'strict',
      description: 'Fail the build if the scan or layout reported any warning',
    }),
  },
  handler: async (args) => {
    const p = await Build.build(process.cwd())
    if (args.print) printSite(p.json)
    await Node.Fs.ensureDir(args.file)
    await Node.Fs.writeFile(args.file, JSON.stringify(p.json))

    // A slug collision silently rewrites URLs across the site, so a project
    // that cares about stable links wants it to be a build failure.
    const problems = p.diagnostics.filter((d) => d.level === 'warn' || d.level === 'error')
    if (args.strict && problems.length) {
      console.error(pc.red(`\n${problems.length} diagnostic(s) reported and --strict is set.`))
      process.exitCode = 1
    }
  },
})
