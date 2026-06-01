import { App } from '@lickle/docs/ui'
import { render } from 'solid-js/web'

import { getJson, setJson, getRendered } from '../../../ui/context/global.ts'

// @ts-ignore
import initialDocs from 'virtual:lickle/docs.json'

// @ts-ignore
import '@lickle/docs/theme.css'

// @ts-ignore
import 'virtual:lickle/custom.ts'
import { createEffect } from 'solid-js'

declare global {
  interface ImportMeta {
    hot: {
      on: (event: string, callback: (payload: any) => void) => void
    }
  }
}

if (initialDocs) setJson(initialDocs)
if (import.meta.hot) import.meta.hot.on('docs-update', (payload) => setJson(payload))

createEffect(() => {
  if (getRendered() === false) return render(() => <App json={getJson()} />, document.getElementById('root')!)
  return () => {}
})
