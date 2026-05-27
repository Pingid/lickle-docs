import { createContext, createMemo, useContext, type Accessor } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

import * as docs from '@lickle/docs'

import { auto, routables, surface, type NavGroup, type NavItem, type NavStrategy } from '../util/project.js'

export type ProjectBag = {
  project: docs.Project
  navGroups: NavGroup[]
  routables: docs.Declaration[]
  /** Public surface from the entrypoint(s): direct routables + namespace re-exports. */
  surface: NavItem[]
}

const ProjectCtx = createContext<Accessor<ProjectBag>>()

export const ProjectProvider = (props: {
  children: JSX.Element
  json: docs.ProjectJson
  /** Override the sidebar grouping. Defaults to {@link auto}. */
  navGroups?: NavStrategy
}) => {
  const bag = createMemo<ProjectBag>(() => {
    const project = docs.createProject(props.json)
    const strategy = props.navGroups ?? auto
    return {
      project,
      navGroups: strategy(project),
      routables: routables(project),
      surface: surface(project),
    }
  })
  return <ProjectCtx.Provider value={bag}>{props.children}</ProjectCtx.Provider>
}

export const useProject = (): ProjectBag => {
  const fn = useContext(ProjectCtx)
  if (!fn) throw new Error('useProject must be used within <ProjectProvider>')
  return fn()
}

export const useNavGroups = (): NavGroup[] => useProject().navGroups

const ReflectionIdCtx = createContext<number>(-1)

/** Scope a subtree to a reflection id so nested `<Comment>`s pass it to tag handlers. */
export const ReflectionScope = (props: { id: number; children: JSX.Element }) => (
  <ReflectionIdCtx.Provider value={props.id}>{props.children}</ReflectionIdCtx.Provider>
)

export const useReflectionId = (): number | undefined => useContext(ReflectionIdCtx)
