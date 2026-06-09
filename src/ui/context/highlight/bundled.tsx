import { bundledLanguagesInfo } from 'shiki/langs'
import type { JSX } from 'solid-js/jsx-runtime'

import { LanguagesProvider } from './context.tsx'

export const BundledLanguagesProvider = (props: { children: JSX.Element }) => (
  <LanguagesProvider langs={() => bundledLanguagesInfo}>{props.children}</LanguagesProvider>
)
