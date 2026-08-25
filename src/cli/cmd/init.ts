import * as cmd from 'cmd-ts'
import path from 'node:path'
import pc from 'picocolors'

import { Node, Pkg } from '../../_lib/index.ts'

/**
 * Scaffold a config and a docs folder.
 *
 * Nothing is overwritten without `--force`, the config included — re-running
 * `init` in a configured project should be a no-op, not a way to lose your
 * layout.
 */
export const init = cmd.command({
  name: 'init',
  description: 'Scaffold a config file and docs directory with a starter guide and component example',
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
      description: 'Path to write the configuration file to (defaults to ./lickle.ts)',
    }),
    force: cmd.flag({
      long: 'force',
      short: 'f',
      description: 'Overwrite existing scaffold files instead of skipping them',
    }),
  },
  handler: async (args) => {
    const cwd = process.cwd()
    const configPath = path.resolve(cwd, args.file ?? 'lickle.ts')
    const docsDir = path.resolve(cwd, args.dir ?? 'docs')

    const name = await projectName(cwd)
    // The config references the docs folder by path, so it has to follow
    // `--dir` rather than assume `./docs`.
    const docsRef = relativeRef(path.dirname(configPath), docsDir)

    const files: Record<string, string> = {
      [configPath]: config(name, docsRef),
      [path.join(docsDir, 'guides', '01-getting-started.md')]: gettingStarted(name),
      [path.join(docsDir, 'components.tsx')]: components,
      [path.join(docsDir, 'tsconfig.json')]: tsconfig,
      [path.join(docsDir, '.gitignore')]: gitignore,
    }

    let written = 0
    let skipped = 0
    for (const [file, content] of Object.entries(files)) {
      const label = path.relative(cwd, file)
      if (!args.force && (await Node.Fs.exists(file))) {
        console.log(`${pc.yellow('skip')}   ${label} ${pc.gray('(already exists)')}`)
        skipped++
        continue
      }
      await Node.Fs.ensureDirFor(file)
      await Node.Fs.writeFile(file, content)
      console.log(`${pc.green('create')} ${label}`)
      written++
    }

    if (skipped && !written) {
      console.log(`\nNothing to do. Pass ${pc.bold('--force')} to overwrite.`)
      return
    }
    if (skipped) console.log(`\n${pc.gray(`${skipped} file(s) left alone; pass --force to overwrite them.`)}`)
    console.log(`\nNext: ${pc.bold('npx ldocs dev')}`)
  },
})

/** The scaffolded project's name, falling back when there is no readable package.json. */
const projectName = async (cwd: string): Promise<string> => {
  try {
    return (await Pkg.read(cwd))?.name ?? 'My Library'
  } catch {
    return 'My Library'
  }
}

/** Path from the config to the docs dir, always POSIX and explicitly relative. */
const relativeRef = (from: string, to: string): string => {
  const rel = path.relative(from, to).split(path.sep).join('/')
  if (!rel) return '.'
  return rel.startsWith('.') ? rel : `./${rel}`
}

const config = (name: string, docs: string): string =>
  [
    `import { defineConfig } from '@lickle/docs/config'`,
    ``,
    `export default defineConfig({`,
    `  name: ${JSON.stringify(name)},`,
    `  pages: [`,
    `    // The README becomes the home page.`,
    `    { title: 'Overview', content: './README.md', slug: '/' },`,
    `    // Every guide, flat under a plain "Guides" heading.`,
    `    { glob: '${docs}/guides/*.md', group: 'Guides', folder: false },`,
    `  ],`,
    `  // Delete this line to use the stock renderers.`,
    `  components: '${docs}/components.tsx',`,
    `})`,
    ``,
  ].join('\n')

/**
 * The starter guide. Built from lines rather than a template literal because it
 * contains fenced code blocks, and nesting those inside backticks is a mess.
 */
const gettingStarted = (name: string): string =>
  [
    `---`,
    `title: Getting started`,
    `---`,
    ``,
    `# Getting started`,
    ``,
    `Install ${name}:`,
    ``,
    '```bash',
    `npm install ${name}`,
    '```',
    ``,
    `Add more guides beside this file — each one becomes a page. The title comes`,
    `from the first heading, and a \`01-\` filename prefix sets the order.`,
    ``,
  ].join('\n')

const components = `import { defineComponents, LiveExample } from '@lickle/docs/ui'

// Execute compiled example JS into its live preview host. \`host\` is the DOM
// node the example renders into.
const run = (code: string, host: HTMLElement) => new Function('host', code)(host)

// Opt in to runnable \`@example\` blocks by overriding the \`tag\` slot: render
// \`@example\` tags with an editable live preview (\`transform\` defaults to
// TypeScript + JSX), and defer every other tag to the stock renderer.
export default defineComponents({
  tag: (props) =>
    // Narrow on \`kind\`, not \`tag\`: the catch-all tag shape types \`tag\` as
    // \`string\`, so comparing it never narrows the union.
    props.tag.kind === '@example' ? (
      <LiveExample tag={props.tag} run={run} transform={{}} />
    ) : (
      <props.Default {...props} />
    ),
})
`

const tsconfig = `{
  "extends": "@lickle/docs/tsconfig.json",
  "include": ["**/*.ts", "**/*.tsx"]
}
`

const gitignore = `dist
`
