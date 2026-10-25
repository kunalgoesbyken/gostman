import React from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { watchPreferences } from './lib/preferences'
import { watchDesktopLinks } from './lib/backend/desktopLinks'
import { bootLanguage } from './lib/i18n/boot'

watchPreferences()
watchDesktopLinks()

const container = document.getElementById('root')

const root = createRoot(container)

bootLanguage().then(() => root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <App/>
        </ErrorBoundary>
    </React.StrictMode>
))
