import { createContext, createMemo, useContext, type Accessor } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

import * as docs from '../../core/client.ts'

import { auto, routables, surface, type NavGroup, type NavItem, type NavStrategy } from '../strategies/index.ts'
import { ComponentsProvider, type Components } from './components.tsx'

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
  /** Component overrides — pages, tags, slots, member sections. */
  components?: Components
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
  return (
    <ComponentsProvider value={props.components}>
      <ProjectCtx.Provider value={bag}>{props.children}</ProjectCtx.Provider>
    </ComponentsProvider>
  )
}

export const useProject = (): ProjectBag => {
  const fn = useContext(ProjectCtx)
  if (!fn) throw new Error('useProject must be used within <ProjectProvider>')
  return fn()
}

export const useNavGroups = (): NavGroup[] => useProject().navGroups

const DeclarationIdContext = createContext<Accessor<number | undefined>>(() => undefined)

/**
 * Scope a subtree to a reflection id so nested `<Comment>`s pass it to tag
 * handlers. The id is exposed as a reactive accessor so consumers re-track
 * when the surrounding route swaps to a new declaration.
 */
export const DeclarationScope = (props: { id: number; children: JSX.Element }) => (
  <DeclarationIdContext.Provider value={() => props.id}>{props.children}</DeclarationIdContext.Provider>
)

export const useDeclarationId = (): Accessor<number | undefined> => useContext(DeclarationIdContext)
