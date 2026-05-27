import type * as docs from '../../../core/client.ts'

import { Markdown } from '../../components/Markdown.js'
import { Section } from './shared.js'

export const RemarksTag = (props: { tag: docs.CommentTag }) => (
  <Section title="Remarks">
    <Markdown source={(props.tag as { text?: string }).text ?? ''} />
  </Section>
)
