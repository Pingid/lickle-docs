import { Show } from 'solid-js'

import type * as docs from '../../../core/client.ts'

import { Comment } from '../../shared/Comment.js'
import { Members } from '../sections.js'
import { PageHeader } from '../slots/index.js'

export const EnumPage = (props: { decl: docs.Declaration<'enum'> }) => (
  <article>
    <PageHeader decl={props.decl} />
    <Show when={props.decl.comment}>
      <Comment comment={props.decl.comment} />
    </Show>
    <Members decl={props.decl} />
  </article>
)
