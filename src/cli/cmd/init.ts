import * as cmd from 'cmd-ts'
import path from 'node:path'

import * as lib from '../../_lib/index.ts'

export const init = cmd.command({
  name: 'init',
  description: 'Scaffold a config file and docs directory with a custom-component example',
  args: {
    dir: cmd.option({
      long: 'dir',
      short: 'd',
      type: cmd.optional(cmd.string),
      description: 'Directory to create the docs scaffold in (defaults to ./docs)',
    }),
    file: cmd.option({
      long: 'config',
      short: 'c',
      type: cmd.optional(cmd.string),
      defaultValue: () => path.join(process.cwd(), 'lickle.ts'),
      description: 'Path to write the configuration file to (defaults to ./lickle.ts)',
    }),
    force: cmd.flag({
      long: 'force',
      short: 'f',
      description: 'Overwrite existing scaffold files instead of skipping them',
    }),
  },
  handler: async (args) => {
    const file = args.file ?? path.join(process.cwd(), 'lickle.ts')
    const dir = args.dir ?? path.join(process.cwd(), 'docs')

    await lib.fs.ensureDir(file)
    await lib.fs.writeFile(file, configTemplate)

    await lib.fs.ensureDir(dir)
    await writeInitFiles(dir, args.force)
  },
})

const configTemplate = `
import { defineConfig } from '@lickle/docs/config'

export default defineConfig({
  name: '@lickle/docs',
  pages: [{ title: 'Overview', content: './README.md' }],
  custom: './docs/index.tsx',
})
`

const example = `
import { registerComponent, LiveExample, transform } from '@lickle/docs/ui'

// Execute the compiled example into its preview host. \`host\` is the live DOM
// node, available to the example as a global.
const run = (code: string, host: HTMLElement) => new Function('host', code)(host)

// Opt in to runnable \`@example\` blocks: compile with \`transform\` then \`run\`.
registerComponent('tag.example', (props) => (
  <LiveExample {...props} run={(code, host) => run(transform(code), host)} />
))`

const initFiles = {
  '.gitignore': [`docs.json`, `dist`],
  'index.tsx': [example.trim()],
  'tsconfig.json': [`{`, `  "extends": "@lickle/docs/tsconfig/tsconfig.client.json",`, `  "include": ["*"],`, `}`],
}
const writeInitFiles = async (dir: string, force: boolean = false) => {
  for (const [file, content] of Object.entries(initFiles)) {
    if (force) {
      await lib.fs.writeFile(path.join(dir, file), content.join('\n'))
      continue
    }
    if (await lib.fs.exists(path.join(dir, file))) {
      console.log(`skipping ${file} as it already exists`)
      continue
    }
    await lib.fs.writeFile(path.join(dir, file), content.join('\n'))
  }
}
