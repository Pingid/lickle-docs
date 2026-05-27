export { render } from 'solid-js/web'

// ---------------- Schema types ----------------
export type * from '../core/client.ts'

// ---------------- App shell ----------------
export { Reflection } from './pages/Reflection.js'
export { App, Routes, NotFound } from './App.js'
export { Home } from './pages/Home.js'

// ---------------- Providers + context ----------------
export { ProjectProvider, ReflectionScope, useProject, useReflectionId, type ProjectBag } from './context/project.js'
export { ThemeProvider, useTheme, type ThemeMode } from './context/theme.js'

// ---------------- Registry ----------------
export type {
  Components,
  PageComponents,
  PageComponent,
  TagComponents,
  TagComponent,
  Slots,
  MemberSections,
  ChildSection,
  KnownTagKey,
} from './registry/index.js'
export { ComponentsProvider, useComponents, tag, page } from './registry/index.js'

// ---------------- Namespaces ----------------
export * as primitives from './primitives/index.js'
export * as strategies from './strategies/index.js'
export * as shared from './shared/index.js'
export * as hooks from './hooks/index.js'
export * as theme from './theme/index.js'
