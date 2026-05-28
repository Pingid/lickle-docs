import type * as docs from '../../../core/client.ts'

import { TextBlock } from './shared.tsx'

export const AuthorTag = (props: { tag: docs.CommentTag }) => (
  <TextBlock title="Author" text={(props.tag as { text?: string }).text ?? ''} />
)
