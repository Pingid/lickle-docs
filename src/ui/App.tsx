import { Router, Route, useParams } from '@solidjs/router'
import { Dynamic } from 'solid-js/web'
import { Show } from 'solid-js'

import { Link, Page, Layout } from './components/index.ts'
import { DeclarationScope } from './context/project.tsx'
import { ThemeProvider } from './context/theme.tsx'
import { useReflection } from './hooks/index.ts'

const PathRoute = () => {
  const params = useParams()
  const decl = useReflection(() => params['slug'])
  return (
    <Show when={decl()} fallback={<NotFound />}>
      {(d) => (
        <DeclarationScope id={d().id}>
          {/* <Dynamic component={Page} decl={d()} /> */}
          {/* <References id={d().id} /> */}
        </DeclarationScope>
      )}
    </Show>
  )
}

/** Fallback for routes that don't match a registered path. */
const NotFound = () => (
  <div class="py-20 text-center">
    <h1 class="text-2xl font-semibold mb-2">Not found</h1>
    <p class="text-mute">No declaration matches this URL.</p>
    <Link href="/">Back home</Link>
  </div>
)

/**
 * Stock route table. Exported on its own so a custom `App` can drop it in
 * under a different root, add prefixes, or compose alongside extra routes.
 */
export const Routes = () => (
  <>
    <Route path="/*" component={PathRoute} />
    <Route path="*" component={NotFound} />
  </>
)

/**
 * One-shot app shell: theme context, router, default Layout. Replace any
 * one of the pieces — `ThemeProvider`, `Layout`, `Routes` — and you keep
 * the others.
 */
export const App = () => (
  <ThemeProvider>
    <Router root={(p) => <Layout>{p.children}</Layout>}>
      <Routes />
    </Router>
  </ThemeProvider>
)
