import { Show } from 'solid-js'
import type * as docs from '../../../core/client.ts'

import { Comment } from '../../shared/Comment.tsx'
import { Members } from '../sections.tsx'
import { PageHeader } from '../slots/index.ts'

export const ModulePage = (props: { decl: docs.Declaration<'module'> }) => (
  <article>
    <PageHeader decl={props.decl} />
    <Show when={props.decl.comment}>
      <Comment comment={props.decl.comment} />
    </Show>
    <Members decl={props.decl} />
  </article>
)
