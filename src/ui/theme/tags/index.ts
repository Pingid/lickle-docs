import type { TagComponents } from '../../registry/types.ts'
import { tag } from '../../registry/authoring.ts'

import { ExampleTag, exampleRunnableTag } from './Example.tsx'
import { DeprecatedTag } from './Deprecated.tsx'
import { SatisfiesTag } from './Satisfies.tsx'
import { TemplateTag } from './Template.tsx'
import { ReturnsTag } from './Returns.tsx'
import { RemarksTag } from './Remarks.tsx'
import { DefaultTag } from './Default.tsx'
import { UnknownTag } from './Unknown.tsx'
import { ThrowsTag } from './Throws.tsx'
import { AuthorTag } from './Author.tsx'
import { TypeTag } from './Type.tsx'
import { SeeTag } from './See.tsx'

export { TagSection } from './shared.tsx'

export {
  ReturnsTag,
  ThrowsTag,
  TypeTag,
  SatisfiesTag,
  ExampleTag,
  exampleRunnableTag,
  SeeTag,
  TemplateTag,
  DeprecatedTag,
  RemarksTag,
  AuthorTag,
  DefaultTag,
  UnknownTag,
}

/**
 * Stock tag registry. The `'*'` key is the catch-all: the dispatcher falls
 * through to it for any tag without a more specific entry, so adding a new
 * stock tag is one entry here and nothing else.
 */
export const defaultTags: TagComponents = {
  ...Object.fromEntries([
    tag('@returns', ReturnsTag),
    tag('@throws', ThrowsTag),
    tag('@type', TypeTag),
    tag('@satisfies', SatisfiesTag),
    tag('@example', ExampleTag),
    tag('@see', SeeTag),
    tag('@template', TemplateTag),
  ]),
  // Tags outside CommentTagMap — text-shaped, no narrow author type needed.
  '@deprecated': DeprecatedTag,
  '@remarks': RemarksTag,
  '@author': AuthorTag,
  '@default': DefaultTag,
  '*': UnknownTag,
}
