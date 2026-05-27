export { render } from 'solid-js/web'

// ---------------- Schema types ----------------
export type * from '../core/client.ts'

// ---------------- Data layer ----------------
export { ProjectProvider, ReflectionScope, useProject, useReflectionId, type ProjectBag } from './context/project.js'
export {
  useReflection,
  useReferences,
  useSurface,
  useNavGroups,
  useSearch,
  useSlugFor,
  type ReferenceRow,
} from './hooks/index.js'

// ---------------- Primitives ----------------
export { Type, TypeBlock, TypeBox, SignatureExpr } from './primitives/Type.js'
export { Punct, Kw, Name, TypeLink } from './primitives/syntax.js'
export { KindBadge, KindLabel } from './primitives/Kind.js'
export { Markdown } from './components/Markdown.js'
export { Comment, commentSummaryText } from './components/Comment.js'
export { Signature, SignatureLine } from './components/Signature.js'

// ---------------- Default theme ----------------
export { App } from './App.js'
export { defaultPages } from './theme/pages/index.js'
export { defaultTags } from './theme/tags/index.js'
export { defaultSectionsFor } from './theme/sections.js'

// ---------------- Theme slot defaults ----------------
// Exposed so users overriding one slot can compose with the stock view of
// adjacent slots.
export { PageHeader as DefaultPageHeader } from './theme/components/PageHeader.js'
export { Source as DefaultSource } from './theme/components/Source.js'

// ---------------- Strategies + nav types ----------------
export {
  auto,
  byKind,
  byExports,
  routables,
  surface,
  ancestors,
  isNamespaceReExport,
  type NavGroup,
  type NavItem,
  type NavStrategy,
} from './util/project.js'
export { type Kind, labelOf, shortOf, pluralLabel, groupOrder, isRoutable } from './util/kind.js'

// ---------------- Registry types ----------------
export type {
  Components,
  PageComponents,
  TagComponents,
  TagComponent,
  Slots,
  MemberSections,
  ChildSection,
  KnownTagKey,
} from './registry/index.js'
