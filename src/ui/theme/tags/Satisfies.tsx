import type * as docs from '../../../core/client.ts'

import { TypedText } from './shared.tsx'

export const SatisfiesTag = (props: { tag: docs.CommentTagMap['@satisfies'] }) => (
  <TypedText title="Satisfies" tag={props.tag} />
)
