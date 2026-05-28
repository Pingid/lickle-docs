import type * as docs from '../../../core/client.ts'

import { TypedText } from './shared.tsx'

export const TypeTag = (props: { tag: docs.CommentTagMap['@type'] }) => <TypedText title="Type" tag={props.tag} />
