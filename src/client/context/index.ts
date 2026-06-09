import { Config, Build } from '../../core/index.ts'

import { Node } from '../../_lib/index.ts'

import { clientFiles } from '../env.ts'

export type ViteContext = {
  dir: string
  json: () => Promise<Config.ProjectJson>
  file: () => Promise<string | undefined>
  current: () => Promise<Build.BuildResult>
  rebuild: () => Promise<void>
  on: (cb: () => void) => () => void
}

export type ViteContextOptions = { dir: string }
export const makeContext = (opts: { dir: string }): ViteContext => {
  const builder = Build.loadBuilder(opts.dir)
  builder.rebuild()
  return { ...builder, dir: opts.dir }
}

export const htmlShellGenerator = async () => {
  const template = await Node.Fs.readFile(clientFiles.htmlTemplate, 'utf8')
  return (opts: { body: string; head: string; title: string }) =>
    template.replace('{{TITLE}}', opts.title).replace('{{BODY}}', opts.body).replace('{{HEAD}}', opts.head)
}
