import { Show } from 'solid-js'

import { displayNameOf, type Declaration } from '../../../core/client.ts'

import { KindLabel } from '../../primitives/Kind.js'
import { Breadcrumb, Source } from '../slots/index.js'

/** Stock page header: breadcrumb, name, kind, optional deprecated marker, source line. */
export const PageHeader = (props: { decl: Declaration }) => (
  <header class="mb-5">
    <Breadcrumb id={props.decl.id} />
    <div class="flex items-baseline gap-3 flex-wrap">
      <h1 class="text-2xl font-semibold tracking-tight font-mono">{displayNameOf(props.decl)}</h1>
      <KindLabel kind={props.decl.kind} />
      <Show when={props.decl.comment?.tags?.some((t: { tag: string }) => t.tag === '@deprecated')}>
        <span class="text-xs uppercase tracking-wider text-mute">· deprecated</span>
      </Show>
    </div>
    <Source sources={props.decl.sources} />
  </header>
)
