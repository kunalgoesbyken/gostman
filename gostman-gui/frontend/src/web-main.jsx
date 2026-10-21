import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import WebApp from './WebApp'
import { ErrorBoundary } from './components/ErrorBoundary'
import { isOAuthCallback, relayOAuthCallback } from './lib/backend/oauthPopup'
import { watchSharedLinks } from './lib/sharedLink'
import { watchOpenLinks } from './lib/openLink'
import { watchPreferences } from './lib/preferences'
import { registerServiceWorker, watchInstallPrompt } from './lib/pwa'

function renderApp() {
  watchPreferences()
  watchSharedLinks()
  watchOpenLinks()
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <WebApp />
      </ErrorBoundary>
    </React.StrictMode>
  )
}

watchInstallPrompt()
registerServiceWorker()

if (isOAuthCallback()) relayOAuthCallback()
else renderApp()
