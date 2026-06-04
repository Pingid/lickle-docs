import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const libRoot = fileURLToPath(new URL('../../', import.meta.url))
export const srcRoot = path.resolve(libRoot, 'src')
export const clientRoot = path.resolve(libRoot, 'client')

export const getRootPath = (pth?: string) => (pth ? path.resolve(libRoot, pth) : libRoot)

export const clientFiles = {
  root: clientRoot,
  htmlTemplate: path.resolve(clientRoot, 'index.template.html'),
  entry: {
    main: path.resolve(clientRoot, 'entry.tsx'),
    client: path.resolve(clientRoot, 'entry-client.tsx'),
    server: path.resolve(clientRoot, 'entry-server.tsx'),
  },
}
