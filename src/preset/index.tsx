import { render, App, type Components, ProjectProvider } from '../ui/index.ts'
import type { NavStrategy } from '../ui/strategies/index.ts'
import { ProjectJson } from '../core/client.ts'

export * from './solidjs/index.ts'
export * from '../ui/index.ts'

import './index.css'

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
