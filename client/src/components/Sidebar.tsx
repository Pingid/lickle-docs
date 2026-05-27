import { For, Show } from 'solid-js'
import { A } from '@solidjs/router'

import { useNavGroups } from '../context/index.js'
import { shortOf } from '../util/kind.js'

export const Sidebar = (props: { onNavigate?: () => void; class?: string }) => {
  const navGroups = useNavGroups()

  return (
    <aside class={`text-sm ${props.class ?? ''}`}>
      <nav class="pt-6 pb-12 px-4 space-y-6">
        <div>
          <A
            href="/"
            end
            class="block rounded-md px-2.5 py-1 text-mute hover:bg-hover hover:text-fg transition-colors"
            activeClass="!text-fg !bg-hover font-medium"
            onClick={() => props.onNavigate?.()}
          >
            Overview
          </A>
        </div>
        <For each={navGroups}>
          {(g) => (
            <div>
              <h3 class="text-[0.7rem] uppercase text-mute font-semibold mb-1 px-2.5 tracking-wider">{g.title}</h3>
              <ul>
                <For each={g.items}>
                  {(it) => (
                    <li>
                      <A
                        href={`/r/${it.slug}`}
                        class="flex items-center gap-2 rounded-md px-2.5 py-1 text-mute hover:bg-hover hover:text-fg transition-colors"
                        activeClass="!text-fg !bg-hover font-medium"
                        onClick={() => props.onNavigate?.()}
                      >
                        <Show when={shortOf(it.kind)}>
                          <span class="font-mono text-[0.7rem] w-3.5 text-mute">{shortOf(it.kind)}</span>
                        </Show>
                        <span class="font-mono truncate">{it.name}</span>
                      </A>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          )}
        </For>
      </nav>
    </aside>
  )
}
