import type * as docs from '../../../core/client.ts'

import { TypedText } from './shared.tsx'

export const ThrowsTag = (props: { tag: docs.CommentTagMap['@throws'] }) => <TypedText title="Throws" tag={props.tag} />
