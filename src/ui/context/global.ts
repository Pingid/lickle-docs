import { createSignal, type Signal } from 'solid-js'

import type { Types } from '../context/index.ts'
import type { Components } from './components.tsx'

declare global {
  interface Lickle {
    components: Signal<Components>
    json: Signal<Types.ProjectJson | null>
    rendered: Signal<boolean>
  }
  interface Window {
    lickle: Lickle
  }
}

if (typeof window !== 'undefined') {
  window.lickle = {
    components: createSignal<Components>({}),
    json: createSignal<Types.ProjectJson | null>(null),
    rendered: createSignal<boolean>(false),
  }
}

export const getComponents = () => window.lickle.components[0]()
export const setComponents = (components: Partial<Components>) =>
  window.lickle.components[1]({ ...window.lickle.components[0](), ...components })

export const getJson = () => window.lickle.json[0]()
export const setJson = (json: Types.ProjectJson | null) => window.lickle.json[1](json)

export const getRendered = () => window.lickle.rendered[0]()
export const setRendered = (rendered: boolean) => window.lickle.rendered[1](rendered)
