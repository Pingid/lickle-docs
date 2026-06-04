import * as Config from '../config/index.ts'
import * as Core from '../core/index.ts'
import * as Lib from '../_lib/index.ts'

export type ViteContext = {
  dir: string
  json: () => Promise<Core.project.ProjectJson>
  config: () => Promise<Config.ConfigJson>
  file: () => Promise<string | undefined>
  rebuild: () => void
}

export type ViteContextOptions = {
  config: () => Promise<{ json: Core.project.ProjectJson; config: Config.ConfigJson; file?: string }>
  dir: string
}

export const makeContext = (opts: {
  config: () => Promise<{ json: Core.project.ProjectJson; config: Config.ConfigJson; file?: string }>
  dir: string
}): ViteContext => {
  let options = opts.config()
  const rebuild = Lib.util.serial(() => {
    options = opts.config()
    return options
  })
  return {
    dir: opts.dir,
    json: () => options.then((c) => c.json),
    config: () => options.then((c) => c.config),
    file: () => options.then((c) => c.file),
    rebuild: () => rebuild(),
  }
}
