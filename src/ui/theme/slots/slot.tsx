import type { Component } from 'solid-js'

import { useComponents } from '../../registry/context.js'
import type { Slots } from '../../registry/types.js'

/**
 * Build a slot dispatcher in one line: look up the override under `key`,
 * forward `Default` so it can decorate, otherwise render the default. The
 * override and default share the same prop shape — that's what the
 * `WithDefault<P>` wrapper in {@link Slots} pins down.
 */
export const createSlot =
  <K extends keyof Slots, P extends Record<string, any>>(key: K, Default: Component<P>): Component<P> =>
  (props) => {
    const { slots } = useComponents()
    const Override = slots?.[key] as Component<P & { Default: Component<P> }> | undefined
    return Override ? <Override {...(props as P)} Default={Default} /> : <Default {...props} />
  }
