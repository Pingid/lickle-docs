import type * as docs from '@lickle/docs'

import { TextBlock } from './shared.js'

export const DeprecatedTag = (props: { tag: docs.CommentTag }) => (
  <TextBlock title="Deprecated" text={(props.tag as { text?: string }).text ?? ''} />
)
