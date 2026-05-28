import type * as docs from '../../../core/client.ts'

import { TypedText } from './shared.tsx'

export const ReturnsTag = (props: { tag: docs.CommentTagMap['@returns'] }) => (
  <TypedText title="Returns" tag={props.tag} />
)
