import { createContext, useContext } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

export type Display = 'compact' | 'full'
const DisplayContext = createContext<() => Display>(() => 'full' as Display)

export const DisplayProvider = (props: { value: () => Display; children: JSX.Element }) => {
  return <DisplayContext.Provider value={props.value}>{props.children}</DisplayContext.Provider>
}

export const useDisplay = () => useContext(DisplayContext)
