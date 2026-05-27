import type * as docs from '../../../core/client.ts'

import { TextBlock } from './shared.js'

export const DefaultTag = (props: { tag: docs.CommentTag }) => (
  <TextBlock title="Default" text={(props.tag as { text?: string }).text ?? ''} />
)
