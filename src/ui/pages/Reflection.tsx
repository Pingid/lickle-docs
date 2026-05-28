import { Show } from 'solid-js'
import { useParams, A } from '@solidjs/router'
import { Dynamic } from 'solid-js/web'

import type * as docs from '../../core/client.ts'

import { ReflectionScope } from '../context/project.tsx'
import { References } from '../theme/slots/index.ts'
import { useReflection } from '../hooks/index.ts'
import { useComponents } from '../registry/context.tsx'
import { defaultPages } from '../theme/pages/index.ts'
import type { PageComponent } from '../registry/types.ts'

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

  const pageFor = (k: Kind): PageComponent => pages?.[k] ?? defaultPages[k] ?? defaultPages.module!

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
