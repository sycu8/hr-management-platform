import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const THEME_KEY = 'hrm-theme'
const allowed = new Set(['light', 'dark', 'system'])
const stored = localStorage.getItem(THEME_KEY)
const theme = stored && allowed.has(stored) ? stored : 'system'
document.documentElement.setAttribute('data-theme', theme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
