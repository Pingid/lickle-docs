import type { PageComponents } from '../../registry/types.js'
import { page } from '../../registry/authoring.js'

import { TypeAliasPage } from './TypeAlias.js'
import { InterfacePage } from './Interface.js'
import { FunctionPage } from './Function.js'
import { VariablePage } from './Variable.js'
import { ModulePage } from './Module.js'
import { ClassPage } from './Class.js'
import { EnumPage } from './Enum.js'

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
