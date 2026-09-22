
// The `material-symbols` package's stylesheet used to be imported here. It
// pulls in the complete 3.9 MB icon font — every icon Google publishes — of
// which this app renders 211. The subset and the class rules it provided now
// live in styles/fonts.css alongside Jost and Bodoni.
//import './lib/i18n.js'
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
