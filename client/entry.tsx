import { createEffect, createSignal } from 'solid-js'
import { HashRouter } from '@solidjs/router'
import { render } from 'solid-js/web'

import { type Types, App } from '@lickle/docs/ui'

// @ts-ignore
import initialDocs from 'virtual:lickle/docs.json'

import '@lickle/docs/theme.css'

// @ts-ignore
import * as custom from 'virtual:lickle/custom-components'

const HmrApp = () => {
  const [json, setJson] = createSignal<Types.ProjectJson | null>(initialDocs ?? null)
  createEffect(() => import.meta.hot && import.meta.hot.on('docs-update', (payload) => setJson(payload)))
  return <App components={custom.components} project={json} Router={HashRouter} />
}

render(() => <HmrApp />, document.getElementById('root')!)
