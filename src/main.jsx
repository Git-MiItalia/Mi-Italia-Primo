

// Order matters: index.css defines the :root variables and the element reset,
// so it loads first and everything after it builds on top. mobile.css loads
// last so its breakpoint rules win ties without needing !important.
import './index.css'
import './app-additions.css'
import './App.css'
import './styles/fonts.css'
import './styles/mobile.css'


import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'



createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
