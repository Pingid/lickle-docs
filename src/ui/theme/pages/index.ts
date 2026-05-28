import type { PageComponents } from '../../registry/types.ts'
import { page } from '../../registry/authoring.ts'

import { TypeAliasPage } from './TypeAlias.tsx'
import { InterfacePage } from './Interface.tsx'
import { FunctionPage } from './Function.tsx'
import { VariablePage } from './Variable.tsx'
import { ModulePage } from './Module.tsx'
import { ClassPage } from './Class.tsx'
import { EnumPage } from './Enum.tsx'

export { FunctionPage, VariablePage, TypeAliasPage, ClassPage, InterfacePage, EnumPage, ModulePage }

/**
 * Stock page registry. Re-exports aren't routable so they're omitted; the
 * dispatcher falls back to `defaultPages.module` for any missing kind.
 */
export const defaultPages: PageComponents = Object.fromEntries([
  page('function', FunctionPage),
  page('variable', VariablePage),
  page('type-alias', TypeAliasPage),
  page('class', ClassPage),
  page('interface', InterfacePage),
  page('enum', EnumPage),
  page('module', ModulePage),
])
