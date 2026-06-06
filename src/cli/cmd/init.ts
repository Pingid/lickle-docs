import * as cmd from 'cmd-ts'
import path from 'node:path'

import { Node } from '../../_lib/index.ts'

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

    await Node.Fs.ensureDir(file)
    await Node.Fs.writeFile(file, configTemplate)

    await Node.Fs.ensureDir(dir)
    await writeInitFiles(dir, args.force)
  },
})

const configTemplate = `import { defineConfig } from '@lickle/docs/config'

export default defineConfig({
  name: '@lickle/docs',
  pages: [{ title: 'Overview', content: './README.md' }],
  components: './docs/index.tsx',
})
`

const example = `import { defineComponents, LiveExample } from '@lickle/docs/ui'

// Execute compiled example JS into its live preview host. \`host\` is the DOM
// node the example renders into.
const run = (code: string, host: HTMLElement) => new Function('host', code)(host)

// Opt in to runnable \`@example\` blocks by overriding the \`tag\` slot: render
// \`@example\` tags with an editable live preview (\`transform\` defaults to
// TypeScript + JSX), and defer every other tag to the stock renderer.
export default defineComponents({
  tag: (props) =>
    props.tag.tag === '@example' ? (
      <LiveExample tag={props.tag} run={run} transform={{}} />
    ) : (
      <props.Default {...props} />
    ),
})`

const initFiles = {
  '.gitignore': [`docs.json`, `dist`],
  'index.tsx': [example.trim()],
  'tsconfig.json': [`{`, `  "extends": "@lickle/docs/tsconfig/tsconfig.client.json",`, `  "include": ["*"],`, `}`],
}
const writeInitFiles = async (dir: string, force: boolean = false) => {
  for (const [file, content] of Object.entries(initFiles)) {
    if (force) {
      await Node.Fs.writeFile(path.join(dir, file), content.join('\n'))
      continue
    }
    if (await Node.Fs.exists(path.join(dir, file))) {
      console.log(`skipping ${file} as it already exists`)
      continue
    }
    await Node.Fs.writeFile(path.join(dir, file), content.join('\n'))
  }
}
