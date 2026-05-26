import type { Mode, ReferenceType } from './types.ts'

// export interface ReferenceType {}
declare module './types.ts' {
  export interface ReferenceType<M extends Mode> {
    foo: 1
  }
}
