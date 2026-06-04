import { renderToStringAsync, generateHydrationScript } from 'solid-js/web'
import { StaticRouter } from '@solidjs/router'

import { App, type Types, EagerMarkupProvider } from '@lickle/docs/ui'

import '@lickle/docs/theme.css'

// @ts-ignore
import * as custom from 'virtual:lickle/custom-components'

export const renderPage = async (json: Types.ProjectJson, url: string): Promise<{ body: string; head: string }> => {
  const body = await renderToStringAsync(() => (
    <EagerMarkupProvider>
      <App project={json} components={custom.components} Router={(p) => <StaticRouter {...p} url={url} />} />
    </EagerMarkupProvider>
  ))
  return { body, head: generateHydrationScript() }
}
