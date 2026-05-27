import { useComponents } from '../../registry/context.js'
import { Header as DefaultHeader } from '../../components/Header.js'

/**
 * Dispatcher for `slots.header`. Falls back to the stock {@link DefaultHeader}.
 * The override receives `Default` so it can decorate (`<Default />` plus
 * extras) instead of replacing wholesale.
 */
export const Header = (props: { onMenu?: () => void; onSearch?: () => void }) => {
  const { slots } = useComponents()
  const Override = slots?.header
  if (Override) return <Override Default={() => <DefaultHeader {...props} />} />
  return <DefaultHeader {...props} />
}
