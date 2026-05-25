import { createContext, useContext } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import type { JSONOutput } from 'typedoc'

export const TypedocContext = createContext<JSONOutput.ProjectReflection>()

export const TypedocProvider = (props: { children: JSX.Element; typedoc: JSONOutput.ProjectReflection }) => (
  <TypedocContext.Provider value={props.typedoc}>{props.children}</TypedocContext.Provider>
)

export const useTypedoc = () => useContext(TypedocContext)!
