import { createEffect, createSignal } from 'solid-js'
import { HashRouter, Router } from '@solidjs/router'
import { render } from 'solid-js/web'

import { type Reflect, App, LanguagesProvider } from '../../ui/index.ts'

import components from './virtuals/components.ts'
import languages from './virtuals/languages.ts'
import docs from './virtuals/docs.ts'

import '@lickle/docs/theme.css'

const ROUTER_TYPE = import.meta.env['VITE_ROUTER_TYPE'] as 'hash' | 'browser'

const AppRouter = ROUTER_TYPE === 'hash' ? HashRouter : Router

const HmrApp = () => {
  const [d, setDocs] = createSignal(docs)
  createEffect(
    () =>
      import.meta.hot &&
      import.meta.hot.on('docs-update', (payload) => {
        const data = payload as Reflect.ProjectVersion
        const current = d().versions.findIndex((v) => v.version === data.version!)
        const next = { version: data.version!, slug: '/', get: data }
        if (current === -1) setDocs({ ...d(), versions: [next, ...d().versions] })
        else
          setDocs({ ...d(), versions: [...d().versions.slice(0, current), next, ...d().versions.slice(current + 1)] })
      }),
  )

  return (
    <LanguagesProvider langs={() => languages}>
      <App components={components} docs={d} Router={AppRouter} />
    </LanguagesProvider>
  )
}

render(() => <HmrApp />, document.getElementById('root')!)
