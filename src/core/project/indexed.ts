import * as indexed from '../reflect/indexed.ts'

import type { ProjectJson } from './json.ts'

export interface Project extends ProjectJson, indexed.Indexed {}

export const create = (json: ProjectJson): Project => Object.assign(indexed.build(json.reflections), json)
