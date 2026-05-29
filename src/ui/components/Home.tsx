import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import { createSlot, useProject } from '../context/index.ts'

import { MarkdownPage } from './Page.tsx'

/**
 * Landing route. Renders the first markdown page (e.g. README / Overview)
 * when the project defines any; otherwise falls back to a generated
 * exports listing.
 */
export const Home = createSlot('home', () => {
  const { project } = useProject()
  const first = () => project.pages?.[0]
  return (
    <Show when={first()} fallback={<Surfaced />}>
      {(page) => <MarkdownPage page={page()} />}
    </Show>
  )
})

/** Fallback landing: project name + a flat list of exported entrypoints. */
export const Surfaced = () => {
  const { project } = useProject()
  return (
    <article>
      <h1 class="text-4xl font-semibold tracking-tight mb-2">{project.name}</h1>
      <Show when={project.exports.length}>
        <h2 class="text-xl font-semibold mt-10 mb-4 pb-2 border-b border-line">Exports</h2>
        <ul class="space-y-2">
          <For each={project.exports}>{(exp) => <ExportRow as={exp.as} path={exp.path} />}</For>
        </ul>
      </Show>
    </article>
  )
}

const ExportRow = (props: { as: string; path: string }) => {
  const { project } = useProject()
  const slug = () => {
    const norm = props.path.replace(/^\.\//, '')
    const mod = project.modules().find((m) => m.path && m.path.replace(/^\.\//, '') === norm)
    return mod ? project.slugById.get(mod.id) : undefined
  }
  return (
    <li>
      <Show when={slug()} fallback={<span class="font-mono font-medium">{props.as}</span>}>
        {(s) => (
          <A href={`/r/${s()}`} class="font-mono font-medium hover:opacity-70">
            {props.as}
          </A>
        )}
      </Show>
    </li>
  )
}
