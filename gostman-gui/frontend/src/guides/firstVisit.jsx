import "./browserShim"
import { renderToString } from "react-dom/server"
import { useAppStore } from "../store/appStore"
import { LoadedWorkspace } from "../components/Workspace"
import { webBackend } from "../lib/backend/web"

const stayOnPage = () => {}

webBackend.load().then((data) => {
  useAppStore.getState().hydrate(data)
  Object.assign(useAppStore.getInitialState(), useAppStore.getState())
  const markup = renderToString(<LoadedWorkspace backend={webBackend} onBack={stayOnPage} />)
  process.stdout.write(markup, () => process.exit(0))
}, (error) => {
  process.stderr.write(String(error?.stack || error))
  process.exit(1)
})
