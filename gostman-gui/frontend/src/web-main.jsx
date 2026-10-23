import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import WebApp from './WebApp'
import { ErrorBoundary } from './components/ErrorBoundary'
import { isOAuthCallback, relayOAuthCallback } from './lib/backend/oauthPopup'
import { watchSharedLinks } from './lib/sharedLink'
import { watchOpenLinks } from './lib/openLink'
import { watchPreferences } from './lib/preferences'
import { watchInstallPrompt } from './lib/pwa'
import { LANDING_ROUTE, normalize } from './hooks/useRoute'

const isPrerenderedLanding = (root) => root.hasChildNodes() && normalize(window.location.pathname) === LANDING_ROUTE

function mount(root, app) {
  if (isPrerenderedLanding(root)) {
    hydrateRoot(root, app)
    return
  }
  root.replaceChildren()
  createRoot(root).render(app)
}

function renderApp() {
  watchPreferences()
  watchSharedLinks()
  watchOpenLinks()
  mount(
    document.getElementById('root'),
    <React.StrictMode>
      <ErrorBoundary>
        <WebApp />
      </ErrorBoundary>
    </React.StrictMode>
  )
}

watchInstallPrompt()

if (isOAuthCallback()) relayOAuthCallback()
else renderApp()
