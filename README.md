# @lickle/docs

Generate a documentation site from your TypeScript source. `@lickle/docs` reflects over your code with the TypeScript compiler, reads your TSDoc/JSDoc, and renders a fast, searchable site — no hand-written API pages.

> Early development (`0.0.0-dev.x`); APIs and output may change.

## Install

```bash
pnpm add -D @lickle/docs
```

## Quick start

```bash
npx ldocs dev    # dev server with live reload
npx ldocs build  # build for production
npx ldocs init   # scaffold lickle.ts + docs/ with a component example
```

## CLI

- `ldocs init` — scaffold config and `docs/`. `--dir` (default `./docs`), `--config` (default `./lickle.ts`), `--force`.
- `ldocs dev` — dev server with live reload. `--port`, `--base`, `--router hash|browser`.
- `ldocs build` — build into the output dir. `--static` (SSG), `--no-script` (no client JS, static only), `--router`, `--base`, `--outDir` (default `docs/dist`).
- `ldocs preview` — serve a built site. `--port`, `--base`.
- `ldocs json` — emit the JSON reflection data into `docs/`. `--print` shows the route tree.

## Configuration

Optional — defaults come from `package.json`, git, and your `README.md`. To customize, add a `lickle.ts` (or `.js`/`.mjs`/`.json`) to the project root:

```ts
import { defineConfig } from '@lickle/docs/config'

export default defineConfig({
  name: 'My Library',
  pages: [{ title: 'Overview', content: './README.md' }],
  components: './docs/index.tsx',
})
```

Useful fields:

- `name` / `version` — defaults to `package.json` (version falls back to the latest git tag).
- `entrypoints` — files to document (defaults to those reachable from `main` / `exports`).
- `pages` — extra markdown pages, each `{ title, slug?, content }`.
- `components` — path to a custom components file (see below).
- `languages` — Shiki languages to load (default `['ts']`).
- `links` — navigation links (default: repository URL).
- `exclude` — micromatch globs to omit.

## Custom components & live examples

Point `components` at a file that default-exports `defineComponents(...)`. Override the `tag` slot for runnable `@example` blocks and defer the rest to the stock renderer:

```tsx
import { defineComponents, LiveExample } from '@lickle/docs/ui'

const run = (code: string, host: HTMLElement) => new Function('host', code)(host)

export default defineComponents({
  tag: (props) =>
    props.tag.tag === '@example' ? (
      <LiveExample tag={props.tag} run={run} transform={{}} />
    ) : (
      <props.Default {...props} />
    ),
})
```

The UI is SolidJS, styled with Tailwind via `@lickle/docs/theme.css`.

## Documenting your code

Docs come from standard TSDoc/JSDoc on exported declarations. `@module` sets a module banner; `@example` blocks render as examples (runnable when you opt in via custom components).

````ts
/**
 * Add two numbers.
 *
 * @example
 * ```ts
 * add(1, 2) // => 3
 * ```
 */
export const add = (a: number, b: number): number => a + b
````

## License

[MIT](https://github.com/Pingid/lickle-docs) © Dan Beaven
