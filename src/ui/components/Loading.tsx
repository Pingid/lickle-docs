import { createSignal, onMount } from 'solid-js'
import cn from '@lickle/cn'

export const Loading = () => {
  const [show, setShow] = createSignal(false)
  onMount(() => {
    setTimeout(() => {
      setShow(true)
    }, 100)
  })
  const cls = () => cn('transition-opacity duration-200', show() && 'opacity-100', 'opacity-0')
  return <div class={cls()}>Loading...</div>
}
