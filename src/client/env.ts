import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const libRoot = fileURLToPath(new URL('../../', import.meta.url))
export const clientRoot = path.resolve(libRoot, 'client')

const getPath = (p: string) => {
  if (import.meta.url.endsWith('.js')) return path.resolve(libRoot, 'dist', p + '.js')
  return path.resolve(libRoot, 'src', p + '.ts')
}

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
    json: path.resolve(clientRoot, 'virtuals/json.ts'),
    versions: path.resolve(clientRoot, 'virtuals/versions.ts'),
    components: path.resolve(clientRoot, 'virtuals/components.ts'),
    highlight: getPath('ui/context/markup/dep/languages'),
  },
}
