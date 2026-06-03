import { hydrate } from 'solid-js/web'
import { Router } from '@solidjs/router'

import { App, type Types } from '@lickle/docs/ui'

// json is inlined into the HTML by the shell (Step 3) — read it back
const json = (window as any).__LICKLE_JSON__ as Types.ProjectJson

import '@lickle/docs/theme.css'

// @ts-ignore
import * as custom from 'virtual:lickle/custom-components'

hydrate(() => <App project={json} Router={Router} components={custom.components} />, document.getElementById('root')!)
