import { Router, Route } from '@solidjs/router'

import { ThemeProvider } from './context/theme.tsx'
import { Reflection } from './pages/Reflection.tsx'
import { Layout } from './theme/slots/index.ts'
import { Home } from './pages/Home.tsx'

/** Fallback for routes that don't match a registered path. */
export const NotFound = () => <div class="py-20 text-center text-mute">404</div>

/**
 * Stock route table. Exported on its own so a custom `App` can drop it in
 * under a different root, add prefixes, or compose alongside extra routes.
 */
export const Routes = () => (
  <>
    <Route path="/" component={Home} />
    <Route path="/r/:slug" component={Reflection} />
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
