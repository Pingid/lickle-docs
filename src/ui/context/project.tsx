import { createContext, createMemo, useContext, type Accessor } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

import * as docs from '../../core/client.ts'

import { ComponentsProvider, type Components } from './components.tsx'

export type Project = docs.Project

const ProjectCtx = createContext<Accessor<docs.Project>>()

export type ProjectProviderProps = {
  children: JSX.Element
  json: Accessor<docs.ProjectJson>
  /** Component overrides — pages, tags, slots, member sections. */
  components?: Components
}

export const ProjectProvider = (props: ProjectProviderProps) => {
  const bag = createMemo<docs.Project>(() => docs.createProject(props.json()))
  return (
    <ComponentsProvider value={props.components}>
      <ProjectCtx.Provider value={bag}>{props.children}</ProjectCtx.Provider>
    </ComponentsProvider>
  )
}

export const useProject = (): Accessor<docs.Project> => {
  const fn = useContext(ProjectCtx)
  if (!fn) throw new Error('useProject must be used within <ProjectProvider>')
  return fn
}

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
