import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import WebApp from './WebApp'
import { ErrorBoundary } from './components/ErrorBoundary'
import { isOAuthCallback, relayOAuthCallback } from './lib/backend/oauthPopup'

function renderApp() {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <WebApp />
      </ErrorBoundary>
    </React.StrictMode>
  )
}

if (isOAuthCallback()) relayOAuthCallback()
else renderApp()
