import { Show } from 'solid-js'
import type * as docs from '../../../core/client.ts'

import { Comment } from '../../shared/Comment.js'
import { Type } from '../../primitives/Type.js'
import { PageHeader } from '../slots/index.js'

export const VariablePage = (props: { decl: docs.Declaration<'variable'> }) => (
  <article>
    <PageHeader decl={props.decl} />
    <div class="font-mono text-sm leading-relaxed py-2">
      <span class="text-accent">const </span>
      <span class="font-semibold">{props.decl.name}</span>
      <span class="text-mute">: </span>
      <Type type={props.decl.type} />
      <Show when={props.decl.defaultValue}>
        <span class="text-mute"> = {props.decl.defaultValue}</span>
      </Show>
    </div>
    <Show when={props.decl.comment}>
      <div class="mt-5">
        <Comment comment={props.decl.comment} />
      </div>
    </Show>
  </article>
)
