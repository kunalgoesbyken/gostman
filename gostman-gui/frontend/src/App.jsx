import { Workspace } from "./components/Workspace"
import { desktopBackend } from "./lib/backend/desktop"

function App() {
  return <Workspace backend={desktopBackend} />
}

export default App
