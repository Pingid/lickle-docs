/** Serialise overlapping async invocations; if a call arrives mid-run, replay once. */
export const serial = (fn: () => Promise<void>) => {
  let busy = false
  let queued = false
  const run = async (): Promise<void> => {
    if (busy) return void (queued = true)
    busy = true
    try {
      await fn()
    } catch (e) {
      console.error('[build]', e)
    }
    busy = false
    if (queued) {
      queued = false
      await run()
    }
  }
  return run
}
