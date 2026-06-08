import { createContext, createMemo, Show, useContext, type Accessor } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

import type { ProjectJson } from './types.ts'
import { createProject } from './indexed.ts'
import * as T from './types.ts'

export * as Types from './types.ts'

const ProjectContext = createContext<Accessor<T.Project>>()

export const ProjectProvider = (props: {
  children: JSX.Element
  json: Accessor<ProjectJson | null>
  version?: Accessor<string>
}) => {
  const bag = createMemo<T.Project | undefined>(() => {
    if (!props.json()) return undefined
    return createProject(props.json()!, props.version?.())
  })
  return (
    <Show when={bag()} fallback={<div>Missing project json...</div>}>
      {(bag) => <ProjectContext.Provider value={bag}>{props.children}</ProjectContext.Provider>}
    </Show>
  )
}

export const useProject = (): Accessor<T.Project> => {
  const fn = useContext(ProjectContext)
  if (!fn) throw new Error('useProject must be used within <ProjectProvider>')
  return fn
}
