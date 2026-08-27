/**
 * Tokens for rendering type signatures with consistent styling. Use these in
 * custom `declaration` slot overrides so hand-built signatures match the
 * stock renderers.
 *
 * @example preview
 * ```tsx
 * <code class="font-mono text-sm">
 *   <Kw>type</Kw> <Name>Result</Name>
 *   <Punct>{'<'}</Punct>
 *   <TypeArg>T</TypeArg>
 *   <Punct>{'> = '}</Punct>
 *   <Name>Ok</Name>
 *   <Punct>{' | '}</Punct>
 *   <Name>Err</Name>
 * </code>
 * ```
 *
 * @group components
 */

/** Muted punctuation — brackets, commas, `=`, etc. */
export const Punct = (p: { children: string }) => <span class="text-mute">{p.children}</span>

/** Accent keyword — `const`, `type`, `extends`, intrinsics. */
export const Kw = (p: { children: string }) => <span class="text-accent">{p.children}</span>

/** Default-styled identifier. */
export const Name = (p: { children: string }) => <span>{p.children}</span>

/** Type argument — `T`. */
export const TypeArg = (p: { children: string }) => <span>{p.children}</span>
