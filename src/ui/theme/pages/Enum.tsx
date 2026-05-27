import { Show } from 'solid-js'

import type * as docs from '../../../core/client.ts'

import { Comment } from '../../components/Comment.js'
import { Members } from '../../components/Members.js'
import { PageHeader } from '../slots/PageHeader.js'

export const EnumPage = (props: { decl: docs.Declaration<'enum'> }) => (
  <article>
    <PageHeader decl={props.decl} />
    <Show when={props.decl.comment}>
      <Comment comment={props.decl.comment} />
    </Show>
    <Members decl={props.decl} />
  </article>
)
