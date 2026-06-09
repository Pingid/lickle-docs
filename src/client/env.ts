import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const libRoot = fileURLToPath(new URL('../../', import.meta.url))
export const clientRoot = path.resolve(libRoot, 'client')

export const clientFiles = {
  lib: libRoot,
  root: clientRoot,
  htmlTemplate: path.resolve(clientRoot, 'index.html'),
  entry: {
    main: path.resolve(clientRoot, 'entry.tsx'),
    client: path.resolve(clientRoot, 'entry-client.tsx'),
    server: path.resolve(clientRoot, 'entry-server.tsx'),
  },
  virtuals: {
    docs: path.resolve(clientRoot, 'virtuals/docs.ts'),
    components: path.resolve(clientRoot, 'virtuals/components.ts'),
    languages: path.resolve(clientRoot, 'virtuals/languages.ts'),
  },
}
