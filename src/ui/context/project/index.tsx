import { createContext, createMemo, useContext, type Accessor } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

import type { ProjectJson } from './types.ts'
import { createProject } from './indexed.ts'
import * as T from './types.ts'

export * as Types from './types.ts'

const ProjectContext = createContext<Accessor<T.Project | null>>()

export const ProjectProvider = (props: {
  children: JSX.Element
  base?: string
  json: Accessor<ProjectJson | null>
}) => {
  const bag = createMemo<T.Project | null>(() => {
    if (!props.json()) return null
    return createProject(props.json()!, props.base)
  })
  return <ProjectContext.Provider value={bag}>{props.children}</ProjectContext.Provider>
}

export const useProject = (): Accessor<T.Project | null> => {
  const fn = useContext(ProjectContext)
  if (!fn) throw new Error('useProject must be used within <ProjectProvider>')
  return fn
}
