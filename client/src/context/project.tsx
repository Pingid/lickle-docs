import { createContext, createMemo, useContext, type Accessor } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

import { index, type json } from '@lickle/docs'

const ProjectCtx = createContext<Accessor<index.Project>>()
export const ProjectProvider = (props: { children: JSX.Element; json: json.Project }) => {
  const project = createMemo(() => index.build(props.json), [props.json])
  return <ProjectCtx.Provider value={project}>{props.children}</ProjectCtx.Provider>
}

export const useProject = () => {
  const project = useContext(ProjectCtx)
  if (!project) throw new Error('useProject must be used within <ProjectProvider>')
  return project
}
