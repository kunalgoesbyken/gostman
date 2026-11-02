import { useState } from "react"
import { useBrowserOs } from "../../hooks/useBrowserOs"
import { PACKAGE_MANAGERS, packageManagerFor } from "./packageManagers"
import { TerminalBlock } from "./TerminalBlock"
import { TerminalTabs } from "./TerminalTabs"

const byId = (id) => PACKAGE_MANAGERS.find((install) => install.id === id)

const TABS = PACKAGE_MANAGERS.map((install) => ({ id: install.id, content: install.label }))

export function InstallCommands({ className }) {
  const os = useBrowserOs()
  const [chosenId, setChosenId] = useState(null)
  const active = byId(chosenId) ?? packageManagerFor(os)

  const header = <TerminalTabs label="Package manager" value={active.id} onChange={setChosenId} items={TABS} />

  return (
    <div className={className}>
      <TerminalBlock header={header} lines={active.lines} label={`Install Gostman with ${active.label}`} />
    </div>
  )
}
