import { Settings2 } from "lucide-react"
import { IconButton } from "./ui/button"
import { Select } from "./ui/select"
import { ColorDot } from "./ui/colorPicker"
import { ENVIRONMENT_TEXT as TEXT } from "../lib/environmentText"
import { useAppStore } from "../store/appStore"

export function EnvironmentSwitcher() {
  const environments = useAppStore((s) => s.environments)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const setActiveEnvironment = useAppStore((s) => s.setActiveEnvironment)
  const openEnvironmentDialog = useAppStore((s) => s.openEnvironmentDialog)

  const active = environments.find((environment) => environment.id === activeEnvironmentId)
  if (!active) return null

  return (
    <div className="flex min-w-0 items-center gap-1">
      <ColorDot color={active.color} />
      <Select
        value={active.id}
        onChange={(event) => setActiveEnvironment(event.target.value)}
        aria-label="Active environment"
        title={active.name}
        controlSize="md"
        className="w-20 sm:w-28 md:w-44"
      >
        {environments.map((environment) => (
          <option key={environment.id} value={environment.id}>
            {environment.name}
          </option>
        ))}
      </Select>
      <IconButton label={TEXT.title} icon={Settings2} size="icon" onClick={openEnvironmentDialog} />
    </div>
  )
}
