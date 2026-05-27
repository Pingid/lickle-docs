import type * as docs from '../../../core/client.ts'

import { useComponents } from '../../registry/context.js'
import { Source as DefaultSource } from '../components/Source.js'

/** Dispatcher for `slots.source`. */
export const Source = (props: { sources?: docs.Source[] }) => {
  const { slots } = useComponents()
  const Override = slots?.source
  if (Override) return <Override sources={props.sources} Default={DefaultSource} />
  return <DefaultSource sources={props.sources} />
}
