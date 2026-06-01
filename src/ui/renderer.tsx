import { createMemo, type Accessor } from 'solid-js'
import { render } from 'solid-js/web'

import type { Components } from './context/components.tsx'
import { App } from './App.tsx'

import { getJson, getComponents, setComponents } from './context/global.ts'
import type { Types } from './context/index.ts'

export const renderApp = (props?: {
  json?: Accessor<Types.ProjectJson | null> | Types.ProjectJson | null
  components?: Accessor<Components> | Components
  root?: HTMLElement
}) => {
  const json = createMemo(() => {
    const j = typeof props?.json === 'function' ? props?.json() : (props?.json ?? null)
    if (!j) return getJson()
    return j
  })

  const components = createMemo(() => {
    const c = typeof props?.components === 'function' ? props?.components() : (props?.components ?? null)
    if (!c) return getComponents()
    return c
  })

  render(() => <App json={json} components={components} />, props?.root ?? document.getElementById('root')!)
}

export const registerComponent = <K extends keyof Components>(key: K, Component: Components[K]) =>
  setComponents({ [key]: Component })
