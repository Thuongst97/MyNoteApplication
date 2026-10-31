import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Drawing blocks (Excalidraw) load their fonts from the app itself, not from a CDN.
;(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = new URL('excalidraw-assets/', window.location.href).toString()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
