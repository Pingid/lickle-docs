/**
 * An interactive tour of the layout combinators.
 *
 * The real thing runs over a TypeScript program, which the browser has no way
 * to compile. So this page runs the *actual* layout engine — `buildTree`, the
 * same function the build calls — over a small hand-built corpus of
 * declarations. Every combinator behaves exactly as it would on real code; only
 * the input is synthetic.
 *
 * Imports reach into `../src` rather than `@lickle/docs/config` so the demo
 * always reflects this checkout's source instead of a published build. In your
 * own project the algebra comes from `@lickle/docs/config`.
 */
import { createMemo, createSignal, For, Show } from 'solid-js'
import { CodeEditor, type PageProps } from '@lickle/docs/ui'

import type { GroupedItems, SidebarNode } from '../../src/core/layout/types'
import { DEFAULT_LAYOUT, PRESETS, SPECS, Result, run } from './model.ts'

import '../index.css'

export default function LayoutPlayground(props: PageProps) {
  const [code, setCode] = createSignal(DEFAULT_LAYOUT)
  const [active, setActive] = createSignal(PRESETS[0]!.name)

  const result = createMemo<{ ok?: Result; error?: string }>(() => {
    try {
      return { ok: run(code()) }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  })

  const pick = (preset: (typeof PRESETS)[number]) => {
    setActive(preset.name)
    setCode(preset.code)
  }
  const blurb = () => PRESETS.find((p) => p.name === active())?.blurb

  return (
    <article>
      <h1 class="text-2xl font-semibold tracking-tight">{props.route.title}</h1>
      <p class="text-mute mt-2">
        Every combinator below runs through the same <code class="font-mono">buildTree</code> the build uses, over a
        small synthetic project. Pick a preset or edit the code — the sidebar on the right rebuilds as you type.{' '}
        <code class="font-mono">Place</code>, <code class="font-mono">Match</code>, <code class="font-mono">Select</code>{' '}
        and <code class="font-mono">Outline</code> are all in scope.
      </p>

      <div class="flex flex-wrap gap-1.5 mt-6">
        <For each={PRESETS}>
          {(preset) => (
            <button
              type="button"
              onClick={() => pick(preset)}
              aria-current={active() === preset.name ? 'true' : undefined}
              class="px-2.5 py-1 text-xs rounded-md border border-line text-mute hover:text-fg hover:bg-hover
                       aria-current:text-fg aria-current:border-fg/30 aria-current:bg-hover transition-colors cursor-pointer"
            >
              {preset.name}
            </button>
          )}
        </For>
      </div>

      <Show when={blurb()}>{(text) => <p class="text-sm text-mute mt-3 min-h-10">{text()}</p>}</Show>

      <div class="grid lg:grid-cols-2 gap-4 mt-4 items-start">
        <div class="rounded-lg border border-line bg-code-bg p-4 overflow-x-auto">
          <CodeEditor lang="ts" value={code} onChange={setCode} />
        </div>

        <div class="rounded-lg border border-line p-4 min-h-64">
          <Show
            when={result().ok}
            fallback={
              <pre class="text-xs text-red-500 font-mono whitespace-pre-wrap wrap-break-word">{result().error}</pre>
            }
          >
            {(ok) => (
              <>
                <div class="text-[0.6875rem] uppercase tracking-wider text-mute/60 mb-3">
                  sidebar · {ok().pages} page{ok().pages === 1 ? '' : 's'}
                </div>
                <Tree groups={ok().sidebar} slugs={ok().slugs} depth={0} />
                <Show when={ok().warnings.length}>
                  <ul class="mt-4 pt-3 border-t border-line space-y-1">
                    <For each={ok().warnings}>
                      {(w) => <li class="text-[0.6875rem] text-yellow-600 dark:text-yellow-500">{w}</li>}
                    </For>
                  </ul>
                </Show>
              </>
            )}
          </Show>
        </div>
      </div>

      <h2 class="text-lg font-semibold mt-10">The corpus</h2>
      <p class="text-mute text-sm mt-1">
        Thirteen declarations under one entry module, plus two markdown pages.{' '}
        <code class="font-mono">debugOnly</code> is unexported and <code class="font-mono">legacyApi</code> is{' '}
        <code class="font-mono">@internal</code>, so the default filter drops both.{' '}
        <code class="font-mono">formatDate</code> and <code class="font-mono">slugify</code> are exposed through the{' '}
        <code class="font-mono">Utils</code> namespace rather than the entry, which puts them one level deeper — the
        level <code class="font-mono">Place.depth</code> cuts against.
      </p>
      <ul class="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <For each={SPECS}>
          {(spec) => (
            <li class="flex items-baseline gap-2 min-w-0">
              <span class="font-mono text-xs text-mute w-20 shrink-0">{spec.kind}</span>
              <span class="font-mono">{spec.name}</span>
              <span class="text-xs text-mute truncate">{spec.file}</span>
            </li>
          )}
        </For>
      </ul>
    </article>
  )
}

/** The resulting sidebar, rendered as a plain nested list with each node's slug. */
const Tree = (props: { groups: GroupedItems<SidebarNode>[]; slugs: Map<number, string>; depth: number }) => (
  <For each={props.groups}>
    {(group) => (
      <div>
        <Show when={group.group}>
          <div
            class="text-[0.6875rem] uppercase tracking-wider text-mute/55 mt-3 mb-1"
            style={{ 'padding-left': `${props.depth * 0.75}rem` }}
          >
            {group.group}
          </div>
        </Show>
        <For each={group.items}>
          {(node) => (
            <div>
              <div
                class="flex items-baseline gap-2 py-0.5 min-w-0"
                style={{ 'padding-left': `${props.depth * 0.75}rem` }}
              >
                <span class="font-mono text-xs text-mute w-14 shrink-0">
                  {node.kind === 'folder' ? '▸ dir' : node.kind === 'page' ? '¶ page' : 'doc'}
                </span>
                <span class="font-mono text-sm">{node.kind === 'doc' ? (node.display ?? node.label) : node.label}</span>
                <Show when={node.kind !== 'folder'}>
                  <span class="font-mono text-[0.6875rem] text-mute/70 truncate">
                    {(node as { slug: string }).slug || '/'}
                  </span>
                </Show>
              </div>
              <Tree groups={node.children} slugs={props.slugs} depth={props.depth + 1} />
            </div>
          )}
        </For>
      </div>
    )}
  </For>
)
