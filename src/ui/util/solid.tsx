import { createSignal, onMount, type Component } from 'solid-js'

export const clientOnly =
  <P extends Record<string, any>>(load: () => Component<P>): Component<P> =>
  (props) => {
    const [Comp, setComp] = createSignal<Component<P>>()
    onMount(() => setComp(() => load()))
    return <>{Comp()?.(props)}</>
  }
