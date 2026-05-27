import type * as docs from '../../../core/client.ts'

import { TypedText } from './shared.js'

export const SatisfiesTag = (props: { tag: docs.CommentTagMap['@satisfies'] }) => (
  <TypedText title="Satisfies" tag={props.tag} />
)
