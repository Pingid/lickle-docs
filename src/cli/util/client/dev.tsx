import { createEffect, createSignal } from 'solid-js'
import { App } from '@lickle/docs/ui'
import { render } from 'solid-js/web'

// @ts-ignore
import initialDocs from 'virtual:lickle/docs.json'

// @ts-ignore
import '@lickle/docs/theme.css'

declare global {
  interface ImportMeta {
    hot: {
      on: (event: string, callback: (payload: any) => void) => void
    }
  }
}

const HmrApp = () => {
  const [docs, setDocs] = createSignal<any>(initialDocs)

  createEffect(() => {
    if (import.meta.hot) import.meta.hot.on('docs-update', (payload) => setDocs(payload))
  })

  return <App json={docs} />
}

render(() => <HmrApp />, document.getElementById('root')!)
