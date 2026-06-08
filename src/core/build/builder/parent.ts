import { fork } from 'node:child_process'

import { Node } from '../../../_lib/index.ts'

import { on, send, type Result } from './types.ts'
import { build } from '../build.ts'

const file = import.meta.url.endsWith('.js') ? './child.js' : './child.ts'
const childFile = new URL(file, import.meta.url)

export const spawnBuilder = (dir: string) => {
  const subs = new Set<() => void>()

  const resolvers = new Map<string, PromiseWithResolvers<Result>>()
  const init = Promise.withResolvers<Result>()
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
    current: () => current,
    json: () => current.then((c) => c.json),
    config: () => current.then((c) => c.config),
    file: () => current.then((c) => c.file),
    on: (cb: () => void) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
  }
}

export const loadBuilder = (dir: string) => {
  const subs = new Set<() => void>()
  const init = Promise.withResolvers<Result>()
  let current = init.promise

  let abort = new AbortController()
  const rebuild = async () => {
    abort.abort()
    abort = new AbortController()
    await new Promise((resolve) => setTimeout(resolve, 10))
    const result = await build(dir, abort.signal).catch((error) => {
      if (error.message === 'Aborted') return
      console.error(error)
    })
    if (!result) return current
    subs.forEach((cb) => cb())
    init.resolve(result)
    current = Promise.resolve(result)
    return result
  }

  return {
    rebuild,
    current: () => current,
    json: () => current.then((c) => c.json),
    config: () => current.then((c) => c.config),
    file: () => current.then((c) => c.file),
    on: (cb: () => void) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
  }
}
