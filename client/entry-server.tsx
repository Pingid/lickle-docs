import { renderToStringAsync, generateHydrationScript } from 'solid-js/web'
import { StaticRouter } from '@solidjs/router'

import { EagerMarkupProvider } from '../src/ui/context/markup/eager.tsx'
import { App, type Types } from '@lickle/docs/ui'

import '@lickle/docs/theme.css'

import components from './virtuals/components.ts'

export const renderPage = async (json: Types.ProjectJson, url: string): Promise<{ body: string; head: string }> => {
  const body = await renderToStringAsync(() => (
    <EagerMarkupProvider>
      <App project={json} components={components} Router={(p) => <StaticRouter {...p} url={url} />} />
    </EagerMarkupProvider>
  ))
  return { body, head: generateHydrationScript() }
}
