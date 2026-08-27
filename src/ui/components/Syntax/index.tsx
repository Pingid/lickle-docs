/**
 * Tokens for rendering type signatures with consistent styling. Use these in
 * custom `declaration` slot overrides so hand-built signatures match the stock
 * renderers.
 *
 * They take plain children and read no context. Exported as a namespace rather
 * than flat, because `Name`, `Kw` and `Punct` are far too general to sit at the
 * top level of a library's exports — `Syntax.Name` says what it is.
 */

/**
 * Muted punctuation — brackets, commas, `=`, etc.
 *
 * @example preview
 * ```tsx
 * <code class="font-mono text-sm"><Syntax.Name>Result</Syntax.Name><Syntax.Punct>{' = '}</Syntax.Punct><Syntax.Name>Ok</Syntax.Name></code>
 * ```
 */
export const Punct = (p: { children: string }) => <span class="text-mute">{p.children}</span>

/**
 * Accent keyword — `const`, `type`, `extends`, intrinsics.
 *
 * @example preview
 * ```tsx
 * <code class="font-mono text-sm"><Syntax.Kw>type</Syntax.Kw> <Syntax.Name>Result</Syntax.Name></code>
 * ```
 */
export const Kw = (p: { children: string }) => <span class="text-accent">{p.children}</span>

/**
 * Default-styled identifier.
 *
 * @example preview
 * ```tsx
 * <code class="font-mono text-sm"><Syntax.Name>UserConfig</Syntax.Name></code>
 * ```
 */
export const Name = (p: { children: string }) => <span>{p.children}</span>

/**
 * Type argument — `T`.
 *
 * @example preview
 * ```tsx
 * <code class="font-mono text-sm"><Syntax.Name>Result</Syntax.Name><Syntax.Punct>{'<'}</Syntax.Punct><Syntax.TypeArg>T</Syntax.TypeArg><Syntax.Punct>{'>'}</Syntax.Punct></code>
 * ```
 */
export const TypeArg = (p: { children: string }) => <span>{p.children}</span>
