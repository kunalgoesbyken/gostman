import { hydrateRoot } from 'react-dom/client'
import { DocsShell } from './components/docs/DocsShell'

const data = JSON.parse(document.getElementById('docs-data').textContent)
const html = (id) => document.getElementById(id).innerHTML

hydrateRoot(document.getElementById('docs-root'), <DocsShell {...data} content={html('docs-content')} footer={html('docs-footer')} />)
