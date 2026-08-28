import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// Chargé après App pour compléter les feuilles de style des composants
// (mêmes sélecteurs, priorité à la dernière règle) sans recourir à `!important`.
import './responsive.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
