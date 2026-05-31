import { Router, Route, useParams, Navigate } from '@solidjs/router'
import { Show, createMemo } from 'solid-js'

import * as docs from '../core/client.ts'

import { Link, Page, MarkdownPage, Layout } from './components/index.ts'
import { DeclarationScope, useProject } from './context/project.tsx'
import { ThemeProvider } from './context/theme.tsx'

/** First navigable route slug — the implicit home target. */
const firstSlug = (routes: docs.RouteNode[]): string | undefined =>
  (routes.find((r) => r.nav) ?? routes[0])?.slug

/** Resolve the current `/*slug` path to a route and render its page. */
const PathRoute = () => {
  const params = useParams()
  const project = useProject()
  const route = createMemo(() => project.routeForSlug(params['slug'] ?? ''))
  return (
    <Show when={route()} fallback={<Fallback slug={params['slug']} />}>
      {(r) => <RouteView route={r()} />}
    </Show>
  )
}

/** Dispatch a route to the page renderer matching its `page.kind`. */
const RouteView = (props: { route: docs.RouteNode }) => (
  <Show
    when={props.route.page.kind === 'markdown'}
    fallback={<DeclarationView route={props.route as docs.RouteNode<'declaration' | 'module'>} />}
  >
    <MarkdownPage route={props.route as docs.RouteNode<'markdown'>} />
  </Show>
)

const DeclarationView = (props: { route: docs.RouteNode<'declaration' | 'module'> }) => {
  const project = useProject()
  const decl = createMemo(() => project.byId(props.route.page.id))
  return (
    <Show when={decl()} fallback={<NotFound />}>
      {(d) => (
        <DeclarationScope id={d().id}>
          <Page route={props.route} decl={d()} />
        </DeclarationScope>
      )}
    </Show>
  )
}

/** Empty path redirects to the first route; anything else is a miss. */
const Fallback = (props: { slug?: string }) => {
  const project = useProject()
  const first = firstSlug(project.routes)
  return (
    <Show when={!props.slug && first} fallback={<NotFound />}>
      {(slug) => <Navigate href={`/${slug()}`} />}
    </Show>
  )
}

/** Fallback for routes that don't match a registered path. */
const NotFound = () => (
  <div class="py-20 text-center">
    <h1 class="text-2xl font-semibold mb-2">Not found</h1>
    <p class="text-mute">No page matches this URL.</p>
    <Link href="/">Back home</Link>
  </div>
)

/**
 * Stock route table. Exported on its own so a custom `App` can drop it in
 * under a different root, add prefixes, or compose alongside extra routes.
 */
export const Routes = () => <Route path="/*slug" component={PathRoute} />

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
