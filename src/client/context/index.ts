import { Config, Build } from '../../core/index.ts'

import { Node } from '../../_lib/index.ts'

import { clientFiles } from '../env.ts'

export type ViteContext = {
  dir: string
  json: () => Promise<Config.ProjectJson>
  config: () => Promise<Config.UserConfig>
  file: () => Promise<string | undefined>
  rebuild: () => Promise<unknown>
  on: (cb: () => void) => () => void
}

export type ViteContextOptions = {
  dir: string
}

export const makeContext = (opts: { dir: string }): ViteContext => {
  const builder = Build.spawnBuilder(opts.dir)
  return {
    dir: opts.dir,
    json: builder.json,
    config: builder.config,
    file: builder.file,
    rebuild: builder.rebuild,
    on: builder.on,
  }
}

export const htmlShellGenerator = async () => {
  const template = await Node.Fs.readFile(clientFiles.htmlTemplate, 'utf8')
  return (opts: { body: string; head: string; title: string }) =>
    template.replace('{{TITLE}}', opts.title).replace('{{BODY}}', opts.body).replace('{{HEAD}}', opts.head)
}
