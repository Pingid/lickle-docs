import { renderToStringAsync, generateHydrationScript } from 'solid-js/web'
import { StaticRouter } from '@solidjs/router'

import { App, LanguagesProvider, loadHighlighter, type Types } from '@lickle/docs/ui'

import components from './virtuals/components.ts'
import languages from './virtuals/languages.ts'

import '@lickle/docs/theme.css'

export const renderPage = async (json: Types.DocsJson, url: string): Promise<{ body: string; head: string }> => {
  // Pre-build so the synchronous SSR shell pass can highlight code blocks.
  const highlighter = await loadHighlighter(languages)
  const body = await renderToStringAsync(() => (
    <LanguagesProvider langs={() => languages} highlighter={highlighter}>
      <App docs={json} components={components} Router={StaticRouter} url={url} />
    </LanguagesProvider>
  ))
  return { body, head: generateHydrationScript() }
}
