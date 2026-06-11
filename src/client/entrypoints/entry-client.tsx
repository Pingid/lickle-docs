import { Router } from '@solidjs/router'
import { hydrate } from 'solid-js/web'

import { App, type Reflect, LanguagesProvider } from '../../ui/index.ts'

import components from './virtuals/components.ts'
import languages from './virtuals/languages.ts'

import '@lickle/docs/theme.css'

// json is inlined into the HTML by the shell (Step 3) — read it back
const json = (window as any).__LICKLE_JSON__ as Reflect.DocsJson

hydrate(
  () => (
    <LanguagesProvider langs={() => languages}>
      <App docs={json} Router={Router} components={components} />
    </LanguagesProvider>
  ),
  document.getElementById('root')!,
)
