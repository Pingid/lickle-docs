import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const libRoot = fileURLToPath(new URL('../../', import.meta.url))
export const clientRoot = path.resolve(libRoot, 'client')

// const resolve = (...paths: string[]) => {
//   // const
//   return path.resolve(clientRoot, ...paths)
// }

export const clientFiles = {
  lib: libRoot,
  root: clientRoot,
  htmlTemplate: path.resolve(clientRoot, 'index.html'),
  entry: {
    main: fileURLToPath(new URL('./entrypoints/entry.tsx', import.meta.url)),
    client: fileURLToPath(new URL('./entrypoints/entry-client.tsx', import.meta.url)),
    server: fileURLToPath(new URL('./entrypoints/entry-server.tsx', import.meta.url)),
  },
  virtuals: {
    docs: fileURLToPath(new URL('./entrypoints/virtuals/docs.ts', import.meta.url)),
    components: fileURLToPath(new URL('./entrypoints/virtuals/components.ts', import.meta.url)),
    languages: fileURLToPath(new URL('./entrypoints/virtuals/languages.ts', import.meta.url)),
  },
}
