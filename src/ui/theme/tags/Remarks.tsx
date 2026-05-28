import type * as docs from '../../../core/client.ts'

import { Markdown } from '../../shared/Markdown.tsx'
import { TagSection } from './shared.tsx'

export const RemarksTag = (props: { tag: docs.CommentTag }) => (
  <TagSection title="Remarks">
    <Markdown source={(props.tag as { text?: string }).text ?? ''} />
  </TagSection>
)
