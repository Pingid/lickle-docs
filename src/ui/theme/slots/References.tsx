import { useComponents } from '../../registry/context.js'
import { References as DefaultReferences } from '../../components/References.js'

/** Dispatcher for `slots.references`. */
export const References = (props: { id: number }) => {
  const { slots } = useComponents()
  const Override = slots?.references
  if (Override) return <Override id={props.id} Default={DefaultReferences} />
  return <DefaultReferences id={props.id} />
}
