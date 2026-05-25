import fs from 'node:fs/promises'
import path from 'node:path'

export type Opts = {
  /** Predicate for paths to skip. Receives an absolute path. */
  ignore?: (abs: string) => boolean
  /** Debounce window (ms) between change bursts. Default `150`. */
  debounceMs?: number
  /** Optional abort signal; if omitted, an internal one is used. */
  signal?: AbortSignal
}

export type Handle = { stop: () => void }

/** Watch multiple directories, debouncing changes and skipping `ignore` matches. */
export const watchPaths = (paths: string[], onChange: () => void, opts: Opts = {}): Handle => {
  const ignore = opts.ignore ?? (() => false)
  const wait = opts.debounceMs ?? 150
  const ac = opts.signal ? undefined : new AbortController()
  const signal = opts.signal ?? ac!.signal

  let t: NodeJS.Timeout | undefined
  const fire = () => {
    clearTimeout(t)
    t = setTimeout(onChange, wait)
  }

  const run = async (dir: string) => {
    const root = path.resolve(dir)
    try {
      for await (const e of fs.watch(dir, { recursive: true, signal })) {
        if (!e.filename) continue
        if (!ignore(path.join(root, e.filename))) fire()
      }
    } catch {}
  }

  for (const d of paths) void run(d)
  return { stop: () => ac?.abort() }
}
