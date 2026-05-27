import type { PageComponents } from '../../registry/types.js'

import { FunctionPage } from './Function.js'
import { VariablePage } from './Variable.js'
import { TypeAliasPage } from './TypeAlias.js'
import { ClassPage } from './Class.js'
import { InterfacePage } from './Interface.js'
import { EnumPage } from './Enum.js'
import { ModulePage } from './Module.js'

export { FunctionPage, VariablePage, TypeAliasPage, ClassPage, InterfacePage, EnumPage, ModulePage }

/**
 * Stock page registry. Re-exports aren't routable so they're omitted; the
 * dispatcher falls back to `defaultPages.module` for any missing kind.
 */
export const defaultPages: PageComponents = {
  function: FunctionPage,
  variable: VariablePage,
  'type-alias': TypeAliasPage,
  class: ClassPage,
  interface: InterfacePage,
  enum: EnumPage,
  module: ModulePage,
}
