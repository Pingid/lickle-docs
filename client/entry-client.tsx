import { Router } from '@solidjs/router'
import { hydrate } from 'solid-js/web'

import { App, type Types, LanguagesProvider } from '@lickle/docs/ui'

import components from './virtuals/components.ts'
import languages from './virtuals/languages.ts'

import '@lickle/docs/theme.css'

// json is inlined into the HTML by the shell (Step 3) — read it back
const json = (window as any).__LICKLE_JSON__ as Types.ProjectJson

hydrate(
  () => (
    <LanguagesProvider langs={() => languages}>
      <App docs={json} Router={Router} components={components} />
    </LanguagesProvider>
  ),
  document.getElementById('root')!,
)
