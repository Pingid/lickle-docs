import { createSignal, onMount, type Component } from 'solid-js'
import { NoHydration } from 'solid-js/web'

export const clientOnly =
  <P extends Record<string, any>>(load: () => Component<P>): Component<P> =>
  (props) => {
    const [Comp, setComp] = createSignal<Component<P>>()
    onMount(() => setComp(() => load()))
    return <>{Comp()?.(props)}</>
  }

export const staticComponent = <C extends Component<any>>(Component: C): C =>
  ((props) => (
    <NoHydration>
      <Component {...props} />
    </NoHydration>
  )) as C
