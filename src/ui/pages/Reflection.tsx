import { Show, type Component } from 'solid-js'
import { useParams, A } from '@solidjs/router'
import { Dynamic } from 'solid-js/web'

import type * as docs from '../../core/client.ts'

import { ReflectionScope } from '../context/project.js'
import { References } from '../theme/slots/References.js'
import { useReflection } from '../hooks/index.js'
import { useComponents } from '../registry/context.js'
import { defaultPages } from '../theme/pages/index.js'

type Kind = docs.Declaration['kind']

/**
 * Page dispatcher: look up the component for the resolved declaration's kind
 * in the user-supplied `components.pages` registry, falling back to the
 * stock theme. The page component itself owns the layout, header, members,
 * etc. — this file only chooses which one to render.
 */
export const Reflection = () => {
  const params = useParams()
  const decl = useReflection(() => params['slug'])
  const { pages } = useComponents()

  const pageFor = (k: Kind): Component<{ decl: any }> => {
    const override = pages?.[k]
    if (override) return override as Component<{ decl: any }>
    return (defaultPages[k] ?? defaultPages.module) as Component<{ decl: any }>
  }

  return (
    <Show
      when={decl()}
      fallback={
        <div class="py-20 text-center">
          <h1 class="text-2xl font-semibold mb-2">Not found</h1>
          <p class="text-mute">No declaration matches this URL.</p>
          <A href="/" class="inline-block mt-4 underline">
            Back home
          </A>
        </div>
      }
    >
      {(d) => (
        <ReflectionScope id={d().id}>
          <Dynamic component={pageFor(d().kind)} decl={d()} />
          <References id={d().id} />
        </ReflectionScope>
      )}
    </Show>
  )
}
