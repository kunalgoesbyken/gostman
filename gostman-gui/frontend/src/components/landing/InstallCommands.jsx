import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs"
import { useBrowserOs } from "../../hooks/useBrowserOs"
import { PACKAGE_MANAGERS, packageManagerFor } from "./packageManagers"
import { TerminalBlock } from "./TerminalBlock"

const byId = (id) => PACKAGE_MANAGERS.find((install) => install.id === id)

export function InstallCommands({ className }) {
  const os = useBrowserOs()
  const [chosenId, setChosenId] = useState(null)
  const active = byId(chosenId) ?? packageManagerFor(os)

  const header = (
    <Tabs value={active.id} onValueChange={setChosenId} className="h-full min-w-0">
      <TabsList label="Package manager">
        {PACKAGE_MANAGERS.map((install) => (
          <TabsTrigger key={install.id} value={install.id}>
            {install.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )

  return (
    <div className={className}>
      <TerminalBlock header={header} lines={active.lines} label={`Install Gostman with ${active.label}`} />
    </div>
  )
}
