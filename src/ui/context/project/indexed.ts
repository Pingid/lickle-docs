import { createRouter, type ProjectJson } from '../../../core/client/index.ts'
import * as Types from './types.ts'

import { createSearchEngine } from './search.ts'

export const createProject = (project: ProjectJson, base?: string): Types.Project => {
  const json = { ...project }
  const _byId = new Map<number, Types.Declaration>()
  const _byName = new Map<string, Types.Declaration>()
  const _children = new Map<number, Types.Declaration[]>()

  const sourceLink = (src: Types.Source) => {
    if (!json.repository?.fileUrl) return undefined
    return json.repository.fileUrl.replace('{PATH}', `/${src.file}`).replace('{LINE}', src.line.toString())
  }

  for (const declaration of json.routes.declarations) {
    _byId.set(declaration.id, declaration)
    _byName.set(declaration.name, declaration)
    if (!_children.has(declaration.parent)) _children.set(declaration.parent, [])
    _children.get(declaration.parent)?.push(declaration)
  }

  const _router = createRouter({ ...project.routes, base })

  const byId = (id: number): Types.Declaration | undefined => _byId.get(id)

  const nextModule = (id: number): Types.Declaration | undefined => {
    const decl = _byId.get(id)
    if (decl?.kind === 'module') return decl
    if (!decl || !decl.parent) return undefined
    return nextModule(decl.parent)
  }
  const byName = (name: string, scope: number | undefined): Types.Declaration | undefined => {
    if (!scope) return _byName.get(name)
    const parent = scope != null ? nextModule(scope) : undefined
    if (!parent) return _byName.get(name)
    const child = _children.get(parent.id)?.find((d) => d.name === name)
    if (child) return child
    return _byName.get(name)
  }

  const p: Types.Project = json as any as Types.Project

  hide(p, 'byId', byId)
  hide(p, 'byName', byName)
  hide(p, 'sourceLink', sourceLink)
  hide(p, 'routes', _router)
  hide(p, 'search', createSearchEngine(_router, byId))
  return p
}

const hide = <T, K extends keyof T>(obj: T, key: K, value: T[K]) =>
  Object.defineProperty(obj, key, { value, enumerable: false, configurable: true })
