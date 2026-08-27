import { createRoot, getOwner, type Component } from 'solid-js'
import type { JSX } from 'solid-js/jsx-runtime'
import * as solid from 'solid-js'
import { createComponent, insert } from 'solid-js/web'
import h from 'solid-js/h'

import type { ExampleRun } from './Example.tsx'

/** Values an example can reach by name, keyed by the identifier it binds to. */
export type ExampleScope = Record<string, unknown>

/** Options for {@link createSolidRun} beyond the scope. */
export type SolidRunOptions = {
  /**
   * A component wrapped around the rendered example — a provider, a theme, a
   * fixed-size frame.
   *
   * It wraps the **preview only**, not the editor or the tag heading beside it,
   * which is the difference between this and wrapping `<LiveExample>` itself:
   * context meant to change how the example behaves shouldn't also reach the
   * chrome around it.
   *
   * Compose several by nesting them in one component of your own.
   */
  wrapper?: Component<{ children: JSX.Element }>
}

// `new Function` names its parameters, so a key that isn't a plain identifier —
// or is a reserved word — has to be dropped rather than break every preview on
// the page. Module namespaces pick up `default` in particular.
const RESERVED = new Set([
  'default',
  'class',
  'function',
  'const',
  'let',
  'var',
  'return',
  'import',
  'export',
  'new',
  'this',
  'null',
  'true',
  'false',
])
const isBindable = (key: string): boolean => /^[A-Za-z_$][\w$]*$/.test(key) && !RESERVED.has(key)

/**
 * An {@link ExampleRun} that renders SolidJS examples — the counterpart to the
 * plain-script runner, for a project whose examples are components.
 *
 * Pair it with `transform: { jsxPragma: 'h' }` so JSX compiles to calls the
 * runner has in scope. Two example shapes work, and you don't have to say which:
 * a bare element (`<Button>hi</Button>`) is a whole example on its own, while
 * anything with statements returns its own root.
 *
 * The preview renders **inside the docs' own reactive owner**, so an example can
 * use the site's context — `useProject`, the router, the theme — exactly as the
 * component it documents does. That is the part worth not writing by hand:
 * `render()` from `solid-js/web` starts a *detached* root, so every provider
 * above disappears and a preview of anything context-dependent comes out blank
 * with no error to explain why.
 *
 * ## Interpolate accessors, not calls
 *
 * Examples compile through hyperscript, not Solid's JSX transform, so a reactive
 * value has to reach `h` as a function:
 *
 * ```tsx
 * <button>count {n}</button>    // reactive — `h` sees the accessor
 * <button>count {n()}</button>  // renders once; `h` only ever sees a number
 * ```
 *
 * The compiler cannot tell the difference — `{n()}` is evaluated before `h` is
 * called — so the second form shows the initial value and then never updates,
 * with no error. Same rule for derived values: `{() => n() * 2}`, not
 * `{n() * 2}`.
 *
 * Component *props* work the other way round: hyperscript calls any zero-arg
 * function prop before the component sees it, which is how `<Foo bar={() =>
 * n()} />` stays reactive. The cost is that a component whose prop genuinely
 * takes an accessor — `<CodeEditor value={code} />` — cannot be written as an
 * example at all; it receives the string and not the signal.
 *
 * Supply your own `transform` function (Solid's Babel preset) if you would
 * rather write examples exactly as you write components; these two rules are
 * the price of compiling them with sucrase alone.
 *
 * @example Every export of your UI in scope
 * ```tsx
 * import { defineComponents, LiveExample, createSolidRun } from '@lickle/docs/ui'
 * import * as MyLib from 'my-lib'
 *
 * const run = createSolidRun(MyLib)
 *
 * export default defineComponents({
 *   tag: (props) =>
 *     props.tag.kind === '@example' && props.tag.caption?.includes('preview') ? (
 *       <LiveExample tag={props.tag} run={run} transform={{ jsxPragma: 'h' }} />
 *     ) : (
 *       <props.Default {...props} />
 *     ),
 * })
 * ```
 */
export const createSolidRun = (scope: ExampleScope = {}, options: SolidRunOptions = {}): ExampleRun => {
  // `h` and the Solid primitives are always available; anything the caller adds
  // shadows them, so a project can override a name if it wants to.
  const bindings: ExampleScope = { h, ...solid, ...scope }
  const names = Object.keys(bindings).filter(isBindable)
  const values = names.map((key) => bindings[key])

  /**
   * Expression form first: the statement form would evaluate a bare element and
   * discard it, rendering nothing — a silent blank rather than a visible
   * mistake. A snippet that isn't a valid expression is a `SyntaxError`, and
   * only then do we treat it as a body.
   */
  const compile = (code: string): (() => unknown) => {
    try {
      return new Function(...names, `"use strict"; return () => (\n${code}\n)`)(...values)
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err
      return new Function(...names, `"use strict"; return () => {\n${code}\n}`)(...values)
    }
  }

  return (code, host) => {
    const view = compile(code)
    const Wrapper = options.wrapper
    // `children` stays a getter so the example is evaluated inside the wrapper's
    // own render — a provider has to be mounted before what it provides for.
    const mounted = Wrapper
      ? () =>
          createComponent(Wrapper, {
            get children() {
              return view() as JSX.Element
            },
          })
      : view

    return createRoot((dispose) => {
      insert(host, mounted)
      return dispose
    }, getOwner() ?? undefined)
  }
}
