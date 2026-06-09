import * as vite from 'vite'

export * from './components.ts'
export * from './resolve.ts'
export * from './shiki.ts'
export * from './html.ts'
export * from './docs.ts'

/** SSR-only: turn stylesheet imports into empty modules (HTML render needs no CSS). */
export const ignoreCss = (): vite.Plugin => ({
  name: '@lickle/docs:plugin-ignore-css',
  enforce: 'pre',
  load: (id) => (/\.(css|scss|sass|less|styl)(\?|$)/.test(id) ? '' : undefined),
})
