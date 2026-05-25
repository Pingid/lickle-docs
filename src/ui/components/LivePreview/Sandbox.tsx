import { onMount, onCleanup } from 'solid-js'

/** Isolation level for the render container. Only `inline` ships today. */
export type SandboxIsolate = 'inline'

/** The element examples render into, plus its teardown. */
export type Container = { target: HTMLElement; dispose: () => void; reset: () => void }

/** Builds a {@link Container} inside `root`. Add new strategies to {@link strategies}. */
export type ContainerStrategy = (root: HTMLElement) => Container

/** Plain child `div` — no isolation. */
const inline: ContainerStrategy = (root) => {
  const target = document.createElement('div')
  root.appendChild(target)
  return { target, dispose: () => target.remove(), reset: () => target.replaceChildren() }
}

// Shadow DOM / iframe strategies can be added here later (iframe will need an
// async/ready variant since its document isn't available synchronously).
const strategies: Record<SandboxIsolate, ContainerStrategy> = { inline }

/**
 * A contained render location. Resolves a target element via the chosen
 * isolation strategy and hands it back through `ref` once mounted.
 */
export const Sandbox = (props: { isolate?: SandboxIsolate; class?: string; ref?: (target: HTMLElement) => void }) => {
  let root!: HTMLDivElement
  onMount(() => {
    const strategy = strategies[props.isolate ?? 'inline'] ?? inline
    const { target, dispose } = strategy(root)
    props.ref?.(target)
    onCleanup(dispose)
  })
  return <div ref={root} class={props.class} />
}
