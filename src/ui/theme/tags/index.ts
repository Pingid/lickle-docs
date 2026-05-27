import type { TagComponents } from '../../registry/types.js'
import { tag } from '../../registry/authoring.js'

import { ExampleTag, exampleRunnableTag } from './Example.js'
import { DeprecatedTag } from './Deprecated.js'
import { SatisfiesTag } from './Satisfies.js'
import { TemplateTag } from './Template.js'
import { ReturnsTag } from './Returns.js'
import { RemarksTag } from './Remarks.js'
import { DefaultTag } from './Default.js'
import { UnknownTag } from './Unknown.js'
import { ThrowsTag } from './Throws.js'
import { AuthorTag } from './Author.js'
import { TypeTag } from './Type.js'
import { SeeTag } from './See.js'

export { TagSection } from './shared.js'

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
