import { render } from 'solid-js/web'

import type { ProjectProviderProps } from '../ui/context/project.tsx'
import { App, ProjectProvider } from '../ui/index.ts'

export * from './index.ts'
export * from '../ui/index.ts'

// @ts-ignore
import '@lickle/docs/theme.css'

export type { ProjectProviderProps }

export const create = (config: ProjectProviderProps) => {
  return render(
    () => (
      <ProjectProvider json={config.json} components={config.components}>
        <App />
      </ProjectProvider>
    ),
    document.getElementById('root')!,
  )
}
