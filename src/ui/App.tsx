import { Show, createMemo, type Accessor, type Component } from 'solid-js'
import { Route, useParams, Navigate, HashRouter } from './context/router.tsx'
import type { JSX } from 'solid-js/jsx-runtime'

import { ComponentsProvider, ProjectProvider, useProject, type Components } from './context/index.tsx'
import { Link, Page, Layout } from './components/index.ts'
import type { ProjectJson } from '../core/client/index.ts'
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
    <ProjectProvider json={json}>
      <ComponentsProvider value={p.components}>
        <Router base={BASE_URL} root={(p) => <Layout>{p.children}</Layout>}>
          <Routes />
        </Router>
      </ComponentsProvider>
    </ProjectProvider>
  )
}
/**
 * Stock route table. Exported on its own so a custom `App` can drop it in
 * under a different root, add prefixes, or compose alongside extra routes.
 */
export const Routes = () => <Route path="/*slug" component={PathRoute} />

/** Resolve the current `/*slug` path to a route and render its page. */
const PathRoute = () => {
  const params = useParams()
  const project = useProject()
  const route = createMemo(() => project().routes.get({ slug: params['slug'] ?? '' }))

  return (
    <Show when={route()} fallback={<Fallback slug={params['slug']} />}>
      {(r) => <Page route={r()} />}
    </Show>
  )
}

/** Empty path redirects to the first sidebar route; anything else is a miss. */
const Fallback = (props: { slug?: string }) => {
  const project = useProject()
  const first = createMemo(() => project()?.routes.sidebar.roots()[0]?.slug)
  return (
    <Show when={!props.slug && first()} fallback={<NotFound />}>
      {(slug) => <Navigate href={slug()} />}
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
