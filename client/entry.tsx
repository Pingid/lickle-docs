import { createEffect, createSignal } from 'solid-js'
import { HashRouter, Router } from '@solidjs/router'
import { render } from 'solid-js/web'

import { type Types, App } from '@lickle/docs/ui'

// @ts-ignore
import initialDocs from 'virtual:lickle/docs.json'

import '@lickle/docs/theme.css'

// @ts-ignore
import * as custom from 'virtual:lickle/custom-components'

const ROUTER_TYPE = import.meta.env['VITE_ROUTER_TYPE'] as 'hash' | 'browser'
const AppRouter = ROUTER_TYPE === 'hash' ? HashRouter : Router

const HmrApp = () => {
  const [json, setJson] = createSignal<Types.ProjectJson | null>(initialDocs ?? null)
  createEffect(() => import.meta.hot && import.meta.hot.on('docs-update', (payload) => setJson(payload)))
  return <App components={custom.components} project={json} Router={AppRouter} />
}

render(() => <HmrApp />, document.getElementById('root')!)
