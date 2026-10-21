import React from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { watchPreferences } from './lib/preferences'
import { watchDesktopLinks } from './lib/backend/desktopLinks'

watchPreferences()
watchDesktopLinks()

const container = document.getElementById('root')

const root = createRoot(container)

root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <App/>
        </ErrorBoundary>
    </React.StrictMode>
)
