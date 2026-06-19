import type * as vite from 'vite'
import path from 'node:path'

export const virtualFile = (opts: { id: string; path: string; content: () => Promise<string> }) => {
  const Id = opts.id
  const ResolvedId = '\0' + opts.path
  const resolve = (id: string, importer: string | undefined) => {
    if (importer && path.resolve(path.dirname(importer), id) === opts.path) return ResolvedId
    return undefined
  }

  const load = async (id: string) => {
    if (id === ResolvedId) return await opts.content()
    return undefined
  }

  const invalidate = (s: vite.ViteDevServer, reload?: boolean) => {
    const m = s.moduleGraph.getModuleById(ResolvedId)
    if (m) s.moduleGraph.invalidateModule(m)
    if (reload) s.ws.send({ type: 'full-reload', path: '*' })
  }

  const plugin = {
    name: opts.id,
    enforce: 'pre',
    resolveId: resolve,
    load: load,
  } satisfies vite.Plugin

  return { plugin, Id, ResolvedId, invalidate }
}

export const Coder = {
  MARK_START: '__CODE_START__',
  MARK_END: '__CODE_END__',
  inline<T>(d: string) {
    return `${this.MARK_START}${d}${this.MARK_END}` as T
  },
  json<T>(d: T) {
    return this.inline<T>(JSON.stringify(d)) as T
  },
  toCode(d: string) {
    return d.replace(new RegExp(`"${this.MARK_START}(.*?)${this.MARK_END}"`, 'gs'), (_, codeInside) =>
      JSON.parse(`"${codeInside}"`),
    )
  },
}
