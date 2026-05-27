import type * as docs from '../../../core/client.ts'

import { useComponents } from '../../registry/context.js'
import { PageHeader as DefaultPageHeader } from '../components/PageHeader.js'

/** Dispatcher for `slots.pageHeader`. Used by every default page component. */
export const PageHeader = (props: { decl: docs.Declaration }) => {
  const { slots } = useComponents()
  const Override = slots?.pageHeader
  if (Override) return <Override decl={props.decl} Default={DefaultPageHeader} />
  return <DefaultPageHeader decl={props.decl} />
}
