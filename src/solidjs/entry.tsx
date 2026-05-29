import { render } from 'solid-js/web'

import { App, type Components, ProjectProvider } from '../ui/index.ts'
import type { NavStrategy } from '../ui/strategies/index.ts'
import { type ProjectJson } from '../core/client.ts'

export * from './index.ts'
export * from '../ui/index.ts'

// @ts-ignore
import '@lickle/docs/theme.css'

export type UIConfig = {
  json: ProjectJson
  /** Override the sidebar grouping. Defaults to `strategies.auto`. */
  navGroups?: NavStrategy
  /** Component overrides — pages, tags, slots, member sections. */
  components?: Components
}

export const create = (config: UIConfig) => {
  return render(
    () => (
      <ProjectProvider json={config.json} navGroups={config.navGroups} components={config.components}>
        <App />
      </ProjectProvider>
    ),
    document.getElementById('root')!,
  )
}
