import type * as docs from '../../../core/client.ts'

import { TextBlock } from './shared.tsx'

export const DeprecatedTag = (props: { tag: docs.CommentTag }) => (
  <TextBlock title="Deprecated" text={(props.tag as { text?: string }).text ?? ''} />
)
