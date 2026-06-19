import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const libRoot = fileURLToPath(new URL('../../', import.meta.url))
export const clientRoot = path.resolve(libRoot, 'client')

const isSrcEnv = import.meta.url.endsWith('env.ts')

export const resolveFile = (pth: string) => {
  if (isSrcEnv) return path.resolve(libRoot, 'src', pth)
  return path.resolve(libRoot, 'dist', pth.replace(/\.ts$/, '.js').replace(/\.tsx$/, '.jsx'))
}

export const clientFiles = {
  lib: libRoot,
  root: clientRoot,
  htmlTemplate: path.resolve(clientRoot, 'index.html'),
  entry: {
    main: resolveFile('client/entrypoints/entry.tsx'),
    client: resolveFile('client/entrypoints/entry-client.tsx'),
    server: resolveFile('client/entrypoints/entry-server.tsx'),
  },
  virtuals: {
    docs: resolveFile('client/entrypoints/virtuals/docs.ts'),
    components: resolveFile('client/entrypoints/virtuals/components.ts'),
    languages: resolveFile('client/entrypoints/virtuals/languages.ts'),
  },
}
