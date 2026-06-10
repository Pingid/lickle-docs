import { generateHydrationScript, renderToStream } from 'solid-js/web'
import { StaticRouter } from '@solidjs/router'

import { App, LanguagesProvider, loadHighlighter } from '../../ui/index.ts'
import type { DocsInput } from '../../ui/context/index.tsx'

import components from './virtuals/components.ts'
import languages from './virtuals/languages.ts'

import '@lickle/docs/theme.css'

const highlighter = await loadHighlighter(languages)

const root = (json: DocsInput, url: string) => (
  <LanguagesProvider langs={() => languages} highlighter={highlighter}>
    <App docs={json} components={components} Router={StaticRouter} url={url} />
  </LanguagesProvider>
)

const Server = {
  hydrationScript: () => generateHydrationScript(),
  renderToStream: (
    json: DocsInput,
    url: string,
    o?: { onCompleteAll?: (info: { write: (v: string) => void }) => void },
  ) => renderToStream(() => root(json, url), o),
}

export type ServerEntry = typeof Server

export default Server
