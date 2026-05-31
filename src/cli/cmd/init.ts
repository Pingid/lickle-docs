import * as cmd from 'cmd-ts'
import path from 'node:path'

import * as lib from '../../_lib/index.ts'

export const init = cmd.command({
  name: 'init',
  description: 'Create a configuration file with custom component',
  args: {
    dir: cmd.option({
      long: 'dir',
      short: 'd',
      type: cmd.optional(cmd.string),
      description: 'Path to the docs directory',
    }),
    file: cmd.option({
      long: 'config',
      short: 'c',
      type: cmd.optional(cmd.string),
      defaultValue: () => path.join(process.cwd(), 'lickle.ts'),
      description: 'Path to where to create the configuration file',
    }),
    force: cmd.flag({ long: 'force', short: 'f', description: 'Force init even if the docs directory already exists' }),
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
import { registerComponent } from '@lickle/docs/ui'

registerComponent('tag.example', (props) => {
  return (
    <div>
      <h2>Custom wrapper</h2>
      <props.Default {...props} />
    </div>
  )
})`

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
