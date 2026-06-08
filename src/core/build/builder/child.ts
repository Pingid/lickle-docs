import { Config, Build } from '../../../core/index.ts'

import { on, send, type Result } from './types.ts'

/** Lazily load config + reflection JSON for the project rooted at `dir`. */
export const build = async (dir: string): Promise<Result> => {
  const file = await Config.findFile(dir)
  const load = await Config.load(dir)
  const json = await Build.fromConfig(dir, load.config, load.ts)
  return { json, config: load.config, file: file! }
}

on(process, 'message', (message) => {
  if (message.kind === 'rebuild') {
    const { dir, id } = message
    build(dir).then((result) =>
      send({ send: (message) => process.send?.(message) ?? false }, { kind: 'result', result, id }),
    )
  }
})
