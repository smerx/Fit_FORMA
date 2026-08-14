import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { StoreProvider } from './lib/store.tsx'
import { ToolsProvider } from './tools/store.tsx'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ToolsProvider>
        <App />
      </ToolsProvider>
    </StoreProvider>
  </StrictMode>,
)
