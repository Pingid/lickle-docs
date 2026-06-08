import { Build } from '../../../core/index.ts'

import { on, send } from './types.ts'

let abort: AbortController = new AbortController()

on(process, 'message', async (message) => {
  if (message.kind === 'rebuild') {
    const { dir, id } = message
    abort.abort()
    abort = new AbortController()

    try {
      const result = await Build.build(dir, abort.signal).catch((error) => {
        if (error.message === 'Aborted') return
        console.error(error)
      })
      if (!result) return
      send({ send: (message) => process.send?.(message) ?? false }, { kind: 'result', result, id })
    } catch (error) {
      console.error(error)
    }
  }
})
