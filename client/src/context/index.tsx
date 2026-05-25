import { createContext, createMemo, useContext } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import type { JSONOutput } from 'typedoc'

import { buildIndex, type ReflectionIndex } from '../util/reflection.js'
import { useTypedoc, TypedocProvider } from './typedoc.js'

export { ThemeProvider, useTheme, type ThemeMode } from './theme.js'
export { TypedocProvider, useTypedoc } from './typedoc.js'

const IndexCtx = createContext<() => ReflectionIndex>()

export const IndexProvider = (props: { children: JSX.Element }) => {
  const td = useTypedoc()
  const index = createMemo(() => buildIndex(td))
  return <IndexCtx.Provider value={index}>{props.children}</IndexCtx.Provider>
}

export const useIndex = (): ReflectionIndex => {
  const fn = useContext(IndexCtx)
  if (!fn) throw new Error('useIndex must be used within <IndexProvider>')
  return fn()
}

export const Providers = (props: { typedoc: JSONOutput.ProjectReflection; children: JSX.Element }) => (
  <TypedocProvider typedoc={props.typedoc}>
    <IndexProvider>{props.children}</IndexProvider>
  </TypedocProvider>
)
