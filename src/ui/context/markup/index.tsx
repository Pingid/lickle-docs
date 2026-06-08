import { Show, useContext, type JSX } from 'solid-js'

import { LazyMarkupProvider } from './lazy.tsx'
import { MarkupContext } from './context.ts'

export { useMarkup, type MarkupContext } from './context.ts'
export * from './util.ts'

export const MarkupProvider = (props: { children: JSX.Element }) => {
  const ctx = useContext(MarkupContext)
  return (
    <Show when={ctx?.()} fallback={<LazyMarkupProvider>{props.children}</LazyMarkupProvider>}>
      {(_) => props.children}
    </Show>
  )
}
