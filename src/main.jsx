
import 'material-symbols/outlined.css'
import './i18n/index.js'
import './app-additions.css'
import './App.css'
import './styles/fonts.css'


import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'



createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
