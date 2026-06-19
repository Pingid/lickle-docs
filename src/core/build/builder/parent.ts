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

  let initial = Promise.withResolvers<Result>()
  let current: Promise<Result> = initial.promise
  let abort: AbortController = new AbortController()

  const rebuild = async () => {
    abort.abort()
    abort = new AbortController()
    try {
      const c = await build(dir, abort.signal)
      initial.resolve(c)
      current = Promise.resolve(c)
      subs.forEach((cb) => cb())
    } catch (error) {
      if (error instanceof DOMException) return
      console.error(error)
    }
  }

  return {
    rebuild,
    current: () => current,
    json: () => current.then((c) => c.json),
    file: () => current.then((c) => c.file),
    on: (cb: () => void) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
  }
}
