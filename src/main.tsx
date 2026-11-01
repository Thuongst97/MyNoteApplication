// First import: tells Excalidraw where its bundled fonts are (see the file for why it's first).
import './excalidrawAssets'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './fonts'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
