/* @refresh reload */
import { render } from 'solid-js/web'

import { ProjectProvider } from './context/index.js'
import { App } from './App.js'

import reflect from '../reflect.json'
import './index.css'

const root = document.getElementById('root')

render(
  () => (
    <ProjectProvider json={reflect as any}>
      <App />
    </ProjectProvider>
  ),
  root!,
)
