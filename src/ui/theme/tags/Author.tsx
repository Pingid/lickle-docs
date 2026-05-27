import type * as docs from '../../../core/client.ts'

import { TextBlock } from './shared.js'

export const AuthorTag = (props: { tag: docs.CommentTag }) => (
  <TextBlock title="Author" text={(props.tag as { text?: string }).text ?? ''} />
)
