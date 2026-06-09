import { createMemo, type Accessor } from 'solid-js'

import { useDocActiveProject, type Types } from '../../context/index.tsx'

export interface Project extends Omit<Types.ProjectJson, 'routes'> {
  byId(id: number): Types.Declaration | undefined
  byName(name: string, scope: number | undefined): Types.Declaration | undefined
  sourceLink(src: Types.Source): string | undefined
}

const INSTANCE = new WeakMap<Types.ProjectJson, Project>()

export const useProject = (): Accessor<Project | undefined> => {
  const doc = useDocActiveProject()
  return createMemo(() => {
    const prj = doc.current()
    if (!prj) return undefined
    if (INSTANCE.has(prj)) return INSTANCE.get(prj)!
    const r = createProject(prj)
    INSTANCE.set(prj, r)
    return r
  })
}

export const createProject = (project: Types.ProjectJson): Project => {
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

  const p: Project = json as any as Project

  hide(p, 'byId', byId)
  hide(p, 'byName', byName)
  hide(p, 'sourceLink', sourceLink)
  return p
}

const hide = <T, K extends keyof T>(obj: T, key: K, value: T[K]) =>
  Object.defineProperty(obj, key, { value, enumerable: false, configurable: true })
