/* @refresh reload */
import { render } from 'solid-js/web'

// import { Providers } from './context/index.js'
import { App } from './App.js'

const root = document.getElementById('root')

render(
  () => (
    // <Providers typedoc={typedoc as any}>
    <App />
    // </Providers>
  ),
  root!,
)

// // import './context/llm/index.ts'
// import './context/llm/w.js'
