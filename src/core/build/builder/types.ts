import type { Serializable } from 'node:child_process'
import { is } from '@lickle/is'

import type { Build } from '../../../core/index.ts'

export type Result = Build.BuildResult
export type Message = { kind: 'rebuild'; dir: string; id: string } | { kind: 'result'; result: Result; id: string }

type Receiver = {
  on: (event: string, listener: (message: Message) => void) => void
  off?: (event: string, listener: (message: Message) => void) => void
}

const isMessage = is.struct({ kind: is.oneOf('rebuild', 'result') }, false)

export const on = (child: Receiver, event: string, listener: (message: Message) => void): (() => void) => {
  const handler = (message: Message) => (isMessage(message) ? listener(message) : undefined)
  child.on(event, handler)
  return () => child.off?.(event, handler)
}

type Sender = { send: (message: Serializable, callback?: ((error: Error | null) => void) | undefined) => boolean }

export const send = (child: Sender, message: Message) =>
  new Promise<void>((resolve, reject) => {
    child.send(message, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
