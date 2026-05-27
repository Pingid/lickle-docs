import { createContext, createMemo, useContext, type Accessor } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

import * as docs from '@lickle/docs'

import { auto, buildSlugs, routables, type NavGroup, type NavStrategy, type Slugs } from '../util/project.js'

export type ProjectBag = {
  project: docs.Project
  slugById: Slugs['slugById']
  idBySlug: Slugs['idBySlug']
  slugByName: Slugs['slugByName']
  qualifiedNameById: Slugs['qualifiedNameById']
  navGroups: NavGroup[]
  routables: docs.Declaration[]
}

const ProjectCtx = createContext<Accessor<ProjectBag>>()

export const ProjectProvider = (props: {
  children: JSX.Element
  json: docs.PojectJson
  /** Override the sidebar grouping. Defaults to {@link auto}. */
  navGroups?: NavStrategy
}) => {
  const bag = createMemo<ProjectBag>(() => {
    const project = docs.createProject(props.json)
    const slugs = buildSlugs(project)
    const strategy = props.navGroups ?? auto
    return {
      project,
      ...slugs,
      navGroups: strategy(project, slugs.slugById),
      routables: routables(project),
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
