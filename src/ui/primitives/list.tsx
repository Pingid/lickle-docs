import { For, Show, type JSX } from 'solid-js'
import cn from '@lickle/cn'

/**
 * A two-column term/description grid, baseline-aligned so a monospace term
 * lines up with the prose beside it. The shape behind the "Parameters" and
 * "Properties" tables and the `@template` list.
 *
 * @example preview
 * ```tsx
 * <DescList>
 *   <DescRow term={<span class="font-mono font-semibold">tag</span>}>
 *     The <Mono>@example</Mono> tag to render.
 *   </DescRow>
 *   <DescRow term={<span class="font-mono font-semibold">run</span>}>
 *     Executes the compiled code into the preview host.
 *   </DescRow>
 * </DescList>
 * ```
 *
 * @group primitives
 */
export const DescList = (props: { class?: string; children: JSX.Element }) => (
  <dl class={cn('grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 items-baseline', props.class)}>{props.children}</dl>
)

/**
 * One term/description pair. Uses `display: contents` so both cells join the
 * parent {@link DescList} grid rather than forming a nested one.
 *
 * @group primitives
 */
export const DescRow = (props: { term: JSX.Element; class?: string; children: JSX.Element }) => (
  <>
    <dt class={cn('font-mono text-sm whitespace-nowrap', props.class)}>{props.term}</dt>
    <dd class="text-sm text-mute min-w-0">{props.children}</dd>
  </>
)

/**
 * A vertical list of scannable rows — the member listings, the search results,
 * the module export index all share it.
 *
 * @example preview
 * ```tsx
 * <ItemList>
 *   <ItemRow
 *     badge={<KindBadge kind="function" class="w-3.5 shrink-0" />}
 *     title={<span class="font-mono font-semibold text-sm">defineComponents</span>}
 *     meta={<span class="font-mono text-sm text-mute">(components: C): C</span>}
 *     summary="Declare slot overrides with type checking."
 *   />
 *   <ItemRow
 *     badge={<KindBadge kind="type-alias" class="w-3.5 shrink-0" />}
 *     title={<span class="font-mono font-semibold text-sm">Components</span>}
 *     summary="The named slots of the site, with their override signatures."
 *   />
 * </ItemList>
 * ```
 *
 * @group primitives
 */
export const ItemList = (props: { class?: string; children: JSX.Element }) => (
  <ul class={cn('space-y-3', props.class)}>{props.children}</ul>
)

/**
 * One row of an {@link ItemList}: an optional leading cue, the title, a
 * trailing detail that truncates rather than wraps, and a two-line summary
 * indented under the title.
 *
 * @group primitives
 */
export const ItemRow = (props: {
  badge?: JSX.Element
  title: JSX.Element
  /** Trailing detail — a signature, a path. Truncates. */
  meta?: JSX.Element
  summary?: JSX.Element
  class?: string
}) => (
  <li class={props.class}>
    <div class="flex items-baseline gap-2.5 min-w-0">
      {props.badge}
      {props.title}
      <Show when={props.meta != null}>
        <span class="min-w-0 truncate">{props.meta}</span>
      </Show>
    </div>
    <Show when={props.summary != null}>
      <p class={cn('text-sm text-mute mt-1 line-clamp-2', props.badge != null && 'pl-6')}>{props.summary}</p>
    </Show>
  </li>
)

/**
 * A simple data table with the site's hairline rules. Rows are plain arrays,
 * so a table is one literal rather than a tree of `<tr>`s — which is also what
 * makes it previewable.
 *
 * @example preview
 * ```tsx
 * <Table
 *   columns={['Slot', 'Receives']}
 *   rows={[
 *     ['layout', 'children, loading'],
 *     ['page', 'route'],
 *     ['tag', 'tag'],
 *   ]}
 * />
 * ```
 *
 * @group primitives
 */
export const Table = (props: { columns: JSX.Element[]; rows: JSX.Element[][]; class?: string }) => (
  <div class={cn('overflow-x-auto', props.class)}>
    <table class="w-full text-sm border-collapse">
      <thead>
        <tr>
          <For each={props.columns}>
            {(col) => (
              <th class="text-left font-semibold text-xs uppercase tracking-wider text-mute border-b border-line pb-2 pr-4 last:pr-0">
                {col}
              </th>
            )}
          </For>
        </tr>
      </thead>
      <tbody>
        <For each={props.rows}>
          {(row) => (
            <tr>
              <For each={row}>
                {(cell) => <td class="border-b border-line py-2 pr-4 last:pr-0 align-baseline">{cell}</td>}
              </For>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </div>
)
