import { createMemo, type Accessor } from 'solid-js'

import { useDocActiveProject, type Reflect } from '../../context/index.tsx'

/** A `ProjectVersion` with lookup indexes layered on top. */
export interface Project extends Omit<Reflect.ProjectVersion, 'routes'> {
  /** The declaration with this id. */
  byId(id: number): Reflect.Declaration | undefined
  /** The declaration with this name. With a `scope` id, names resolve within the scope's module before falling back project-wide. */
  byName(name: string, scope: number | undefined): Reflect.Declaration | undefined
  /** Repository URL for a source location, from the `repository.fileUrl` template. */
  sourceLink(src: Reflect.Source): string | undefined
}

const INSTANCE = new WeakMap<Reflect.DocsVersion, Project>()

/**
 * Indexed access to the active version's data. The {@link Project} is built once per version and reused.
 * @group hooks
 * */
export const useProject = (): Accessor<Project | undefined> => {
  const doc = useDocActiveProject()
  return createMemo(() => {
    const prj = doc.json()
    const active = doc.version()
    if (!prj || !active) return undefined
    if (INSTANCE.has(active)) return INSTANCE.get(active)!
    const r = createProject(prj)
    INSTANCE.set(active, r)
    return r
  })
}

/** Index a raw `ProjectVersion` into a {@link Project}: id and name maps plus source-link resolution. */
export const createProject = (project: Reflect.ProjectVersion): Project => {
  const json = { ...project }
  const _byId = new Map<number, Reflect.Declaration>()
  const _byName = new Map<string, Reflect.Declaration>()
  const _children = new Map<number, Reflect.Declaration[]>()

  const sourceLink = (src: Reflect.Source) => {
    if (!json.repository?.fileUrl) return undefined
    return json.repository.fileUrl.replace('{PATH}', `/${src.file}`).replace('{LINE}', src.line.toString())
  }

  for (const declaration of json.declarations) {
    _byId.set(declaration.id, declaration)
    _byName.set(declaration.name, declaration)
    if (!_children.has(declaration.parent)) _children.set(declaration.parent, [])
    _children.get(declaration.parent)?.push(declaration)
  }

  const byId = (id: number): Reflect.Declaration | undefined => _byId.get(id)

  const nextModule = (id: number): Reflect.Declaration | undefined => {
    const decl = _byId.get(id)
    if (decl?.kind === 'module') return decl
    if (!decl || !decl.parent) return undefined
    return nextModule(decl.parent)
  }
  const byName = (name: string, scope: number | undefined): Reflect.Declaration | undefined => {
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
