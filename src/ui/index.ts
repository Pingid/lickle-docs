export type * as Types from '../core/client.ts'

export * from './components/index.ts'
export * from './App.tsx'

export {
  ProjectProvider,
  DeclarationScope as ReflectionScope,
  useProject,
  useDeclarationId as useReflectionId,
  type ProjectBag,
} from './context/project.tsx'
export { ThemeProvider, useTheme, type ThemeMode } from './context/theme.tsx'
export { type Components, useComponents } from './context/components.tsx'
// export type {
//   Components,
//   PageComponents,
//   PageComponent,
//   TagComponents,
//   TagComponent,
//   Slots,
//   MemberSections,
//   ChildSection,
//   KnownTagKey,
// } from './registry/index.ts'
// export { render } from 'solid-js/web'

// // ---------------- Schema types ----------------
// export type * from '../core/client.ts'

// // ---------------- App shell ----------------
// export { Reflection } from './pages/Reflection.tsx'
// export { App, Routes } from './App.tsx'
// export { Home } from './pages/Home.tsx'

// // ---------------- Providers + context ----------------
// export { ProjectProvider, ReflectionScope, useProject, useReflectionId, type ProjectBag } from './context/project.tsx'
// export { ThemeProvider, useTheme, type ThemeMode } from './context/theme.tsx'

// // ---------------- Registry ----------------
// export type {
//   Components,
//   PageComponents,
//   PageComponent,
//   TagComponents,
//   TagComponent,
//   Slots,
//   MemberSections,
//   ChildSection,
//   KnownTagKey,
// } from './registry/index.ts'
// export { ComponentsProvider, useComponents, tag, page } from './registry/index.ts'

// // ---------------- Namespaces ----------------
// export * as primitives from './primitives/index.ts'
// export * as strategies from './strategies/index.ts'
// export * as shared from './shared/index.ts'
// export * as hooks from './hooks/index.ts'
// export * as theme from './theme/index.ts'
