import fs from 'node:fs/promises'
import path from 'node:path'

export * from 'node:fs/promises'

export const existingPath = async (path: string) => exists(path).then((exists) => (exists ? path : undefined))

export const exists = async (path: string): Promise<boolean> => {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

/** Create `dir` and any missing parents. */
export const ensureDir = async (dir: string) => {
  if (await exists(dir)) return
  await fs.mkdir(dir, { recursive: true })
}

/**
 * Create the directory a file will be written into.
 *
 * Split from {@link ensureDir} rather than guessed from the path: an
 * extensionless target (`.gitignore`, `LICENSE`, `--file data`) is
 * indistinguishable from a directory name, and guessing wrong creates a
 * directory exactly where the file needed to go.
 */
export const ensureDirFor = async (file: string) => ensureDir(path.dirname(file))

export const sanitizeFilename = (str: string) => {
  return (
    str
      // Remove illegal characters for Windows/Mac/Linux
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      // Remove relative path modifiers
      .replace(/^\.+/g, '')
      // Optional: Replace spaces with underscores or dashes for web-friendliness
      .replace(/\s+/g, '-')
      // Prevent trailing spaces or periods (invalid in Windows)
      .trim()
      .replace(/[\s.]+$/, '')
  )
}

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
