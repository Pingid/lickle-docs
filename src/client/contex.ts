import * as Config from '../config/index.ts'
import * as Core from '../core/index.ts'

import { Node, Util } from '../_lib/index.ts'
import { clientFiles } from './env.ts'

export type ViteContext = {
  dir: string
  json: () => Promise<Core.Config.ProjectJson>
  config: () => Promise<Config.UserConfig>
  file: () => Promise<string | undefined>
  rebuild: () => Promise<unknown>
  on: (cb: () => void) => () => void
}

export type ViteContextOptions = {
  config: () => Promise<{ json: Core.Config.ProjectJson; config: Config.UserConfig; file?: string }>
  dir: string
}

export const makeContext = (opts: {
  config: () => Promise<{ json: Core.Config.ProjectJson; config: Config.UserConfig; file?: string }>
  dir: string
}): ViteContext => {
  const subs = new Set<() => void>()
  let options = opts.config()
  const rebuild = Util.serial(() => {
    options = opts.config()
    subs.forEach((cb) => cb())
    return options
  })
  return {
    dir: opts.dir,
    json: () => options.then((c) => c.json),
    config: () => options.then((c) => c.config),
    file: () => options.then((c) => c.file),
    rebuild,
    on: (cb: () => void) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
  }
}

export const htmlShellGenerator = async () => {
  const template = await Node.Fs.readFile(clientFiles.htmlTemplate, 'utf8')
  return (opts: { body: string; head: string; title: string }) =>
    template.replace('{{TITLE}}', opts.title).replace('{{BODY}}', opts.body).replace('{{HEAD}}', opts.head)
}
