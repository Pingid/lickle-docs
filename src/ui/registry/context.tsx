import { createContext, useContext } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

import type { Components } from './types.js'

const ComponentsCtx = createContext<Components>({})

export const ComponentsProvider = (props: { value?: Components; children: JSX.Element }) => (
  <ComponentsCtx.Provider value={props.value ?? {}}>{props.children}</ComponentsCtx.Provider>
)

/** Read the active component registry. Empty when no overrides were supplied. */
export const useComponents = (): Components => useContext(ComponentsCtx)
