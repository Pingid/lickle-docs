/**
 * Main entry point for the test package.
 */

// Local named exports
export { MathUtils } from './namespaces'

// Re-export everything from reexports
export * from './reexports'

// Exporting a local declaration
/**
 * The version of the package.
 */
export const VERSION = '1.0.0'

// Exporting an imported module as a namespace
import * as types from './types'
export { types }
