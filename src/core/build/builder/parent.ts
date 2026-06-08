import { fork } from 'node:child_process'

import type { Config } from '../../../core/index.ts'
import { Node } from '../../../_lib/index.ts'

import { on, send, type Result } from './types.ts'

const file = import.meta.url.endsWith('.js') ? './child.js' : './child.ts'
const childFile = new URL(file, import.meta.url)

export const spawnBuilder = (dir: string) => {
  const subs = new Set<() => void>()

  const resolvers = new Map<string, PromiseWithResolvers<Result>>()
  const init = Promise.withResolvers<{ json: Config.ProjectJson; config: Config.Config; file: string }>()
  let current = init.promise

  const child = fork(childFile)
  Node.onExit(() => child.kill())

  on(child, 'message', (message) => {
    if (message.kind === 'result') {
      const resolver = resolvers.get(message.id)
      if (resolver) {
        resolver.resolve(message.result)
        resolvers.delete(message.id)
      }
      current = Promise.resolve(message.result)
      subs.forEach((cb) => cb())
    }
  })

  return {
    kill: () => child.kill(),
    rebuild: () => {
      const id = Node.id()
      send(child, { kind: 'rebuild', dir, id })
      const resolver = Promise.withResolvers<Result>()
      resolvers.set(id, resolver)
      return resolver.promise
    },
    json: () => current.then((c) => c.json),
    config: () => current.then((c) => c.config),
    file: () => current.then((c) => c.file),
    on: (cb: () => void) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
  }
}
