import { renderToStringAsync, generateHydrationScript } from 'solid-js/web'
import { StaticRouter } from '@solidjs/router'

import { App, LanguagesProvider, type Types } from '@lickle/docs/ui'

import components from './virtuals/components.ts'
import languages from './virtuals/languages.ts'

import '@lickle/docs/theme.css'

export const renderPage = async (json: Types.ProjectJson, url: string): Promise<{ body: string; head: string }> => {
  const body = await renderToStringAsync(() => (
    <LanguagesProvider langs={() => languages}>
      <App docs={json} components={components} Router={(p) => <StaticRouter {...p} url={url} />} />
    </LanguagesProvider>
  ))
  return { body, head: generateHydrationScript() }
}
