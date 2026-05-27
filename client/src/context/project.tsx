import { createContext, createMemo, useContext, type Accessor } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'

import { index, type json } from '@lickle/docs'

import { buildNavGroups, buildSlugs, routables, type NavGroup, type Slugs } from '../util/project.js'

export type ProjectMeta = {
  /** Markdown rendered on the home page when set. */
  readme?: string
  /** Displayed next to the project name in the header. */
  version?: string
  /** Header social/nav links: `[label, href]`. */
  links?: ReadonlyArray<readonly [label: string, href: string]>
}

export type ProjectBag = {
  project: index.Project
  meta: ProjectMeta
  slugById: Slugs['slugById']
  idBySlug: Slugs['idBySlug']
  slugByName: Slugs['slugByName']
  qualifiedNameById: Slugs['qualifiedNameById']
  navGroups: NavGroup[]
  routables: index.Declaration[]
}

const ProjectCtx = createContext<Accessor<ProjectBag>>()

export const ProjectProvider = (props: { children: JSX.Element; json: json.Project; meta?: ProjectMeta }) => {
  const bag = createMemo<ProjectBag>(() => {
    const project = index.build(props.json)
    const slugs = buildSlugs(project)
    return {
      project,
      meta: props.meta ?? {},
      ...slugs,
      navGroups: buildNavGroups(project, slugs.slugById),
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
