import { useComponents } from '../../registry/context.js'
import { Sidebar as DefaultSidebar } from '../../components/Sidebar.js'

/** Dispatcher for `slots.sidebar`. */
export const Sidebar = (props: { onNavigate?: () => void; class?: string }) => {
  const { slots } = useComponents()
  const Override = slots?.sidebar
  if (Override) return <Override Default={() => <DefaultSidebar {...props} />} />
  return <DefaultSidebar {...props} />
}
