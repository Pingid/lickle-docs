/**
 * A minimal `process` for the browser.
 *
 * The layout algebra is pure and worth running client-side — the layout
 * playground page evaluates it live — but `Match.file` reaches micromatch,
 * whose picomatch reads `process.platform` and `process.version` unguarded at
 * module load. Shiki's textmate grammar reads `process.env` the same way.
 *
 * Vite's `define` can't fix this: both arrive pre-bundled by the dependency
 * optimizer, which `define` does not touch. A runtime global does, provided it
 * exists before those modules initialise — hence the bare side-effect module,
 * imported first in every entry. ES modules evaluate imports in declaration
 * order, so "first" is load-bearing.
 *
 * `??=` so the real `process` on the server is left alone.
 */
// Cast away the Node typings: this is a stand-in, not a `NodeJS.Process`.
const g = globalThis as unknown as { process?: Record<string, unknown> }

g.process ??= { env: {}, platform: 'browser', version: 'v20.0.0', argv: [], cwd: () => '/' }

export {}
