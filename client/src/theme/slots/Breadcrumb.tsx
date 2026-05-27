import { useComponents } from '../../registry/context.js'
import { Breadcrumb as DefaultBreadcrumb } from '../../components/Breadcrumb.js'

/** Dispatcher for `slots.breadcrumb`. */
export const Breadcrumb = (props: { id: number }) => {
  const { slots } = useComponents()
  const Override = slots?.breadcrumb
  if (Override) return <Override id={props.id} Default={DefaultBreadcrumb} />
  return <DefaultBreadcrumb id={props.id} />
}
