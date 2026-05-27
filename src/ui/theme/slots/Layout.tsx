import type { JSX } from 'solid-js/jsx-runtime'

import { useComponents } from '../../registry/context.js'
import { Layout as DefaultLayout } from '../../components/Layout.js'

/**
 * Dispatcher for `slots.layout`. Wraps the whole router root so users can
 * inject a top-level shell (banner, sidebar columns, theme provider, etc.).
 */
export const Layout = (props: { children: JSX.Element }) => {
  const { slots } = useComponents()
  const Override = slots?.layout
  if (Override) return <Override Default={DefaultLayout}>{props.children}</Override>
  return <DefaultLayout>{props.children}</DefaultLayout>
}
