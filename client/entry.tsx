import { createEffect, createSignal } from 'solid-js'
import { HashRouter, Router } from '@solidjs/router'
import { render } from 'solid-js/web'

import { type Types, App } from '@lickle/docs/ui'

import components from './virtuals/components.ts'
import versions from './virtuals/versions.ts'
import docs from './virtuals/json.ts'

import '@lickle/docs/theme.css'

const ROUTER_TYPE = import.meta.env['VITE_ROUTER_TYPE'] as 'hash' | 'browser'

const AppRouter = ROUTER_TYPE === 'hash' ? HashRouter : Router

const HmrApp = () => {
  const [json, setJson] = createSignal<Types.ProjectJson | null>(docs ?? null)
  createEffect(() => import.meta.hot && import.meta.hot.on('docs-update', (payload) => setJson(payload)))
  return <App components={components} project={json} Router={AppRouter} versions={versions} />
}

render(() => <HmrApp />, document.getElementById('root')!)
