import { Show, createMemo, type Accessor, type Component } from 'solid-js'
import { Route, useParams, Navigate, HashRouter } from './context/router.tsx'
import type { JSX } from 'solid-js/jsx-runtime'

import {
  ComponentsProvider,
  DeclarationScope,
  ProjectProvider,
  useProject,
  type Components,
  type Types,
} from './context/index.tsx'
import { Link, Page, MarkdownPage, Layout } from './components/index.ts'
import type { ProjectJson } from '../core/project/types.ts'
import { BASE_URL } from './util/base.ts'

export interface AppProps {
  components?: Components
  project?: Accessor<ProjectJson | null> | ProjectJson
  Router?: Component<{ children: JSX.Element; root?: Component<{ children?: JSX.Element }>; base?: string }>
}

export const App = (p: AppProps) => {
  const json = createMemo(() => (typeof p.project === 'function' ? p.project() : (p.project ?? null)))
  const Router = p.Router ?? HashRouter
  return (
    <ComponentsProvider value={p.components}>
      <ProjectProvider json={json}>
        <Router base={BASE_URL} root={(p) => <Layout>{p.children}</Layout>}>
          <Routes />
        </Router>
      </ProjectProvider>
    </ComponentsProvider>
  )
}
/**
 * Stock route table. Exported on its own so a custom `App` can drop it in
 * under a different root, add prefixes, or compose alongside extra routes.
 */
export const Routes = () => <Route path="/*slug" component={PathRoute} />

/** First navigable route slug — the implicit home target. */
const firstSlug = (routes: Types.RouteNode[]): string | undefined => (routes.find((r) => r.sidebar) ?? routes[0])?.slug

/** Resolve the current `/*slug` path to a route and render its page. */
const PathRoute = () => {
  const params = useParams()
  const project = useProject()
  const route = createMemo(() => project().routeForSlug(params['slug'] ?? ''))
  return (
    <Show when={route()} fallback={<Fallback slug={params['slug']} />}>
      {(r) => <RouteView route={r()} />}
    </Show>
  )
}

/** Dispatch a route to the page renderer matching its `page.kind`. */
const RouteView = (props: { route: Types.RouteNode }) => (
  <Show
    when={props.route.page.kind === 'markdown'}
    fallback={<DeclarationView route={props.route as Types.RouteNode<'declaration' | 'module'>} />}
  >
    <MarkdownPage route={props.route as Types.RouteNode<'markdown'>} />
  </Show>
)

const DeclarationView = (props: { route: Types.RouteNode<'declaration' | 'module'> }) => {
  const project = useProject()
  const decl = createMemo(() => project().byId(props.route.page.id))
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
  const first = createMemo(() => firstSlug(project()?.routes ?? []))
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
