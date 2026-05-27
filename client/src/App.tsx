import { Router, Route } from '@solidjs/router'

import { ThemeProvider } from './context/index.js'
import { Reflection } from './pages/Reflection.js'
import { Layout } from './theme/slots/Layout.js'
import { Home } from './pages/Home.js'

export const App = () => (
  <ThemeProvider>
    <Router root={(props) => <Layout>{props.children}</Layout>}>
      <Route path="/" component={Home} />
      <Route path="/r/:slug" component={Reflection} />
      <Route path="*" component={() => <div class="py-20 text-center text-mute">404</div>} />
    </Router>
  </ThemeProvider>
)
