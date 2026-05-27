import * as indexed from '../reflect/indexed.ts'

import type { PojectJson } from './scan.ts'

export interface Project extends PojectJson, indexed.Indexed {}

export const create = (json: PojectJson): Project => {
  return Object.assign(indexed.build(json.reflections), json)
}
